# Phase 5 — Temps réel

| | |
|---|---|
| **État** | à faire |
| **Branche** | `feat/refonte-phase-5` |
| **Dépend de** | la phase 4 |
| **Livre** | `apps/realtime` : le multijoueur complet, multi-instances |

## Objectif

Écrire le service WebSocket : `ws` derrière Hono, état des salles dans Redis
muté par scripts Lua, diffusion par Redis pub/sub, minuteries par BullMQ.
Le réducteur de salle et les schémas du protocole existent déjà ; cette phase
les branche sur le monde réel — sockets, horloge, instances multiples.

## Pourquoi maintenant

Le contrat, les règles et l'API solo sont posés : le multijoueur est le
dernier morceau serveur avant le front. C'est aussi la phase qui ferme les
trous d'autorité de l'existant : le serveur n'impose jamais la fin de manche
(une salle reste en `playing` indéfiniment si le dernier joueur non-soumis se
déconnecte, et aucune salle inactive n'a de TTL) ; le chemin de reconnexion
est mort (rien ne met jamais `connected` à `False`, donc score, items et
indices payés sont perdus) ; et plusieurs messages clients ne sont ni validés
ni throttlés.

## Étapes

### 5.1 — Transport et poignée de main

Hono + `ws`, validation à l'entrée par `packages/protocol`. Le pseudo est
validé **et encodé dans l'URL** — il ne l'est pas aujourd'hui alors que la
regex serveur autorise les espaces. Origines WebSocket explicites dès
maintenant.

**Fini quand** : les tests de transport passent contre le service — JSON
invalide → `bad_json` et la connexion survit, type inconnu ignoré, homonyme
connecté refusé, trame au-delà de 64 000 caractères → fermeture 1009, pseudo
avec espace accepté via l'URL encodée.

### 5.2 — État des salles dans Redis

Le réducteur pur de `packages/domain` décide, un script Lua applique la
transition atomiquement. Aucune instance ne détient la vérité : aucune
structure de salle ne vit dans la mémoire du process.

**Fini quand** : sur Redis local, deux transitions concurrentes sur une même
salle ne se perdent pas, et l'état relu après chaque événement est exactement
celui que le réducteur a produit.

### 5.3 — Diffusion pub/sub et backpressure

Canal Redis par salle : n'importe quelle instance sert n'importe quelle
socket. Diffusion en parallèle avec budget par socket, éviction du socket
mort au moment de l'échec — aujourd'hui la diffusion est séquentielle et un
socket lent ralentit toute la salle.

**Fini quand** : un test de protocole fait dialoguer deux instances sur une
même salle, et un socket volontairement bloqué ne retarde pas la réception
des autres joueurs.

### 5.4 — Minuteries BullMQ

Jobs différés pour la fin de manche par timeout, le TTL de salle inactive et
les vagues d'items. C'est ce qui ferme « le serveur n'impose jamais la fin
de manche » : aujourd'hui `time_limit` n'est appliqué que par le client.

**Fini quand** : une manche dont le dernier joueur non-soumis se déconnecte
se termine par timeout côté serveur, et une salle inactive disparaît à
l'échéance de son TTL — les deux vérifiés par tests de protocole.

### 5.5 — Reconnexion

Jeton de session porté par le client, `connected: false` réellement écrit à
la déconnexion, fenêtre de grâce avant éviction. Pendant la fenêtre, le
pseudo n'est pas reprenable par un tiers.

**Fini quand** : un test coupe la socket en pleine manche puis se reconnecte
— score, items et indices payés sont retrouvés — et un homonyme est refusé
pendant la fenêtre de grâce.

### 5.6 — Durcissement des messages clients

Throttle serveur sur `cursor` **et** `live_score` — absent sur le second
aujourd'hui, qui est rebroadcasté à toute la salle sans validation, un
vecteur d'amplification. `targets` d'un `use_item` validées : pas
d'auto-ciblage, nombre de cibles fermé. `set_ready` refuse un `time_limit`
de l'hôte en pleine manche. `FREEZE_TIME` prend son effet serveur : les
−10 s entament réellement le bonus temps au lieu d'être purement visuels.

**Fini quand** : chaque point a son test de protocole — un flood de
`live_score` n'est pas rebroadcasté au-delà du throttle, l'auto-ciblage est
refusé, `time_limit` est figé en manche, `FREEZE_TIME` entame le bonus temps.

### 5.7 — Autorité d'hôte et fin de salle

`force_start`, `force_pick`, `start_game` renvoient `not_host` à un invité
sans changer l'état de la salle ; un invité change son `ready` mais ni
`time_limit` ni `with_items` ; le joueur suivant est promu au départ de
l'hôte ; la salle disparaît quand le dernier joueur part. Un seul chemin de
démarrage de manche : celui du réducteur.

**Fini quand** : les invariants d'autorité serveur passent en tests de
protocole sur le multijoueur, y compris le breakdown à zéro pour des
pénalités déclarées par le client.

## Porte de sortie

- Les garanties d'autorité serveur et de robustesse du transport passent en
  tests de protocole contre le service, côté multijoueur.
- Une manche survit à une coupure réseau d'un joueur.
- Deux instances servent une même salle dans la suite de tests.
- Fin de manche par timeout et TTL de salle inactive effectifs.

## Invariants concernés

Voir `01-contrat-a-preserver.md` : l'**autorité serveur** (la solution ne
quitte pas le serveur, indices monotones facturés une fois, rôle d'hôte
décidé et vérifié serveur) et la **robustesse du transport** (pseudo,
homonymes, JSON invalide, bornes de trame, throttles) sont le cœur de la
phase. Le **barème** est touché à la marge par le bonus temps : `time_limit`
figé en manche et effet serveur de `FREEZE_TIME`.

## Pièges

- **Aucune logique métier dans Lua.** Redis + Lua est plus complexe que le
  dict en mémoire qu'il remplace ; la parade est déjà décidée : le réducteur
  décide, le script applique. Un `if` métier dans un script Lua est le signe
  qu'on dérive.
- **Origines et jetons explicites dès cette phase**, pas en fin de parcours :
  deux hébergeurs (Vercel + Fly), donc CORS et origines WebSocket à tenir.
- **Un seul chemin de démarrage de manche.** L'existant en a deux,
  divergents — c'est par là que les pénalités fuyaient d'une manche à
  l'autre.
- **Tester à deux instances dès la 5.3.** Un état qui s'infiltre en mémoire
  process ne se voit qu'à plusieurs instances.
- **Annuler le job de fin de manche** quand la manche se termine
  normalement, sinon il tombera sur la manche suivante.
