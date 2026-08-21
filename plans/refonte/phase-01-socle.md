# Phase 1 — Socle

| | |
|---|---|
| **État** | à faire |
| **Branche** | `feat/refonte-phase-1` |
| **Dépend de** | phase 0 |
| **Livre** | `packages/protocol` et `packages/domain`, purs et testés |

## Objectif

Créer les deux paquets marqués ★ dans `00-vue-densemble.md` : `protocol`, source unique
des contrats — un schéma Zod par message WebSocket et par DTO REST — et
`domain`, les règles du jeu en fonctions pures : barème, correction des
réponses, catalogue d'items, machine à états de salle sous forme de réducteur
`(state, event) → {state, effects}`. Aucune I/O, aucune horloge implicite.

## Pourquoi maintenant

Le contrat avant les règles, les règles avant les services : tout ce qui suit
importe ces deux paquets. C'est la phase qui supprime structurellement les
duplications de vérité (§2.1.8 : barème présent deux fois, identifiants
d'items synchronisés à la main) et qui rend visibles les deux transitions
absentes de la machine à états actuelle : fin de manche par timeout, fin de
manche à la déconnexion du dernier joueur (§2.1.4).

## Étapes

### 1.1 — Squelette des deux paquets

`packages/protocol` et `packages/domain` sur la configuration partagée de la
phase 0. `protocol` n'a qu'une dépendance runtime, Zod ; `domain` dépend de
`protocol` et de rien d'autre.

**Fini quand** : `pnpm build`, `pnpm test` et `pnpm typecheck` passent avec un
test trivial dans chaque paquet, et le graphe de dépendances est celui-là.

### 1.2 — Messages WebSocket

Un schéma par message entrant et sortant, calqué sur la table de dispatch
actuelle. Les codes d'erreur deviennent une union fermée (`room_not_found`,
`invalid_name`, `name_taken`, `bad_json`, `not_host`, `hints_blocked`, …).
`game_start` n'a qu'une seule forme de `players` : la divergence des deux
chemins de démarrage (§2.1.3) devient irreprésentable.

**Fini quand** : chaque message de la table de dispatch a son schéma, les
types sont inférés par `z.infer` (aucun type redéclaré à la main), et des
fixtures invalides sont rejetées avec le bon code.

### 1.3 — DTO REST et assertion négative

Schémas de `game/{start,hint,scan,submit}`, `health`, `usage`,
`multiplayer/create`, `flag-report`. Le payload de départ ne peut pas
représenter la solution : ni positions falsifiées, ni explications, ni
indices, ni `original_text` — seulement le nombre de faux.

**Fini quand** : un test sérialise un départ de partie complet et vérifie,
par clés **et par valeurs**, qu'aucun texte de vérité ni d'indice n'y figure
(§3.1) ; le contrat `/api/health` de §3.7 est représenté au champ près.

### 1.4 — Barème

`score = tp×150 − fp×80 − hint_penalty − score_stolen + time_bonus`, avec
`time_bonus = max(0, time_limit − elapsed) × 0,5`, `HINT_COST = 50`,
`REVEAL_COST = 200`, `STEAL_AMOUNT = 50`. Le temps est un paramètre. Score
négatif possible, pas de bonus au-delà du délai, leaderboard décroissant.

**Fini quand** : le cas de référence de §3.2 passe — `tp=3, fp=1,
pénalité=20, volé=50, 200 s restants sur 300 → 400` — ainsi que les bords
(score négatif, temps dépassé).

### 1.5 — Indices : monotonie et facturation

Pénalité non cumulative (le niveau 2 coûte 200 au total, pas 250), niveaux
monotones, facturés une seule fois. Les pénalités déclarées par le client
sont ignorées : le breakdown se calcule depuis l'état serveur.

**Fini quand** : niveau 2 débloqué puis niveau 1 redemandé renvoie le
niveau 2 sans refacturer ; répéter le niveau 2 ne refacture pas ;
`hintsUsed: 9` déclaré par le client produit un breakdown à zéro.

### 1.6 — Correction des réponses

Fonction pure qui confronte les paragraphes marqués aux `positions` : index
base 1, triés croissants, `false_info_number` séquentiels de 1 à n.

**Fini quand** : les cas de forme de §3.3 passent (base 1, tri, séquence), et
tp/fp sont exacts sur des réponses partielles, vides et sur-marquées.

### 1.7 — Catalogue et effets d'items

Le catalogue est **un** objet : les identifiants ne peuvent plus diverger
entre front et back. Les huit effets sont des fonctions pures : SCANNER
désigne un vrai faux non encore désigné, mémorisé par joueur, `null` à
épuisement ; `HINT_LOCK` refuse l'achat avec `code: hints_blocked` ;
`FREEZE_TIME` entame réellement le bonus temps (§2.1.7) ; les `targets` sont
validés — pas d'auto-ciblage, nombre borné (§2.1.6).

**Fini quand** : chaque effet a ses tests, SCANNER renvoie `null` à
épuisement, et un `use_item` auto-ciblé est rejeté.

### 1.8 — Réducteur de salle : lobby et hôte

Transitions d'entrée et de lobby : rejoindre, quitter, `ready`, vote et
sélection de thème, autorité d'hôte — `force_start`, `force_pick`,
`start_game` renvoient `not_host` à un invité sans changer l'état —,
promotion au départ de l'hôte, disparition de la salle au dernier départ. Un
invité change son `ready` mais ni `time_limit` ni `with_items`, et
`time_limit` est refusé en pleine manche (§2.1.6).

**Fini quand** : chaque transition de lobby a son test, gardes comprises
(`not_host`, message hors phase rejeté explicitement, pas ignoré en silence).

### 1.9 — Réducteur de salle : manche

Un **seul** chemin de démarrage de manche, qui purge tout l'état de manche —
ce qui ferme la fuite de pénalités du chemin par vote (§2.1.2). Soumissions,
fin de manche quand tous ont soumis, et les deux transitions manquantes :
fin de manche par expiration du délai, fin de manche à la déconnexion du
dernier joueur non-soumis (§2.1.4). Les minuteries sont des effets rendus par
le réducteur, pas des `setTimeout` : la phase 6 les branchera sur BullMQ.

**Fini quand** : le réducteur est couvert transition par transition, dont les
deux manquantes, et un test vérifie qu'après un démarrage par vote de thème,
`hint_levels`, `score_stolen`, `hints_blocked_until` et `scanned` sont purgés.

### 1.10 — Documentation générée du protocole

La doc du protocole est générée depuis les schémas Zod et commitée. Le verrou
CI complet (§3.8) arrive en phase 11 ; ici, le générateur et le fichier.

**Fini quand** : un test compare le fichier généré au fichier commité et
échoue sur divergence.

## Porte de sortie

- Les cas de §3.2 et §3.3 passent en tests unitaires purs.
- Le réducteur est couvert transition par transition, y compris les deux qui
  manquent aujourd'hui (timeout, déconnexion du dernier joueur).
- Aucun accès à l'horloge, au réseau ou au disque dans `domain` : le temps
  est un paramètre, les effets sont des données.
- `pnpm build && pnpm test && pnpm lint && pnpm typecheck` passent.

## Invariants concernés

Voir `01-contrat-a-preserver.md` : le **barème exact** (§3.2, cas de
référence compris), la **monotonie des indices** et leur facturation unique,
l'**autorité serveur** (§3.1 : pénalités client ignorées, SCANNER résolu
serveur, `not_host`, vol de score et blocage d'indices appliqués serveur),
la forme du contrat de §3.3 (index base 1, positions triées, numéros
séquentiels) et le **verrou documentaire** (§3.8), dont cette phase pose le
générateur.

## Pièges

- **Le barème de référence est `C2.1` de `01-contrat-a-preserver.md`**, pas `scoring.py` ni
  `config.js` : ces deux fichiers sont la duplication qu'on supprime, et rien
  ne garantit qu'ils sont encore d'accord.
- **Le réducteur décide, il n'applique pas.** Un `setTimeout`, un accès Redis
  ou une date lue dans son corps rendrait la phase 6 intestable. Les effets
  sont des valeurs retournées.
- Ne pas porter les bugs avec le code : le reset partiel de `themes.py`
  (§2.1.2) et le `FREEZE_TIME` purement visuel (§2.1.7) sont des
  comportements à corriger, pas des références.
- Zod tolère les clés inconnues par défaut : pour l'assertion négative de
  1.3, tester la **sérialisation réelle**, pas seulement le schéma.
- Ne pas déborder sur le transport : throttles, reconnexion, TTL de salle
  relèvent de la phase 6. Ici, tout est pur.
