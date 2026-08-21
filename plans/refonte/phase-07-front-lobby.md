# Phase 7 — Front d'avant-manche

| | |
|---|---|
| **État** | à faire |
| **Branche** | `feat/refonte-phase-7` |
| **Dépend de** | phases 4, 5 et 6 |
| **Livre** | tout l'avant-manche en Next.js, et une partie solo jouable |

## Objectif

Porter en Next.js tout ce qui précède la manche : entrée solo / hôte /
rejoindre, salle d'attente, vote de thème, écran de génération, les six
minijeux d'attente et le chat. Au passage, le WebSocket devient un contexte
client au lieu d'un objet muable passé en prop à travers tout l'arbre.

## Pourquoi maintenant

Les phases 4 à 6 ont livré l'API solo, l'auth et le service temps réel : le
front a enfin quelque chose à qui parler. Et l'avant-manche vient avant la
manche parce qu'il pose le contexte WebSocket et le chat que la phase 8
réutilise tels quels — les poser dans la manche d'abord, c'est les poser
deux fois.

## Étapes

### 7.1 — Contexte WebSocket client

Aujourd'hui la socket est créée par `useRoomConnection`, survit à la manche,
et circule en prop (`ws={socket}`) de composant en composant. Elle devient un
provider React monté dans le layout client du groupe `(game)` : connexion,
reconnexion par jeton (phase 6), messages typés par `packages/protocol`,
hook de consommation unique.

**Fini quand** : plus aucun composant ne reçoit la socket en prop, et une
navigation lobby → manche ne rouvre pas la connexion.

### 7.2 — Entrée : solo, héberger, rejoindre

`LobbyEntry` et `LobbyCard` portés : choix du pseudo, les trois onglets,
création de salle, saisie de code. Le pseudo est validé côté client avec le
même schéma `protocol` que le serveur, et **encodé** dans l'URL du WebSocket —
bug 2.1.10 : la regex serveur autorise les espaces, le client ne les encode
pas.

**Fini quand** : les trois entrées mènent au bon écran, un pseudo invalide
est refusé avant tout appel réseau, un pseudo avec espace se connecte.

### 7.3 — Salle d'attente

`RoomLobby`, `PlayerList`, réglages de l'hôte (`TimeLimitSlider`,
`ItemsToggle`), état prêt. Les réglages sont masqués aux invités mais la
vérité reste serveur : un `not_host` reçu s'affiche proprement, il ne plante
pas l'écran.

**Fini quand** : deux navigateurs se voient dans la même salle, un invité ne
change pas les réglages, la promotion d'hôte au départ se reflète à l'écran.

### 7.4 — Vote de thème

`ThemeVoting` porté : propositions, votes, `force_pick` réservé à l'hôte,
résultat annoncé par le serveur.

**Fini quand** : le thème affiché comme élu est celui du message serveur,
jamais un décompte local.

### 7.5 — Écran de génération

`WaitingScreen` perd son handle impératif : aujourd'hui le lobby appelle
`ref.ready(data)` via `useImperativeHandle` quand la manche arrive. L'écran
devient piloté par l'état — il lit `game_start` depuis le contexte de 7.1,
et sa progression est une donnée, pas un handle.

**Fini quand** : plus de `forwardRef` ni de handle, et l'écran enchaîne sur
la manche en solo comme en multijoueur.

### 7.6 — Les six minijeux d'attente

Snake, DinoRun, MemoryCards, ReactionSpeed, PatternMatch, TicTacToe, plus
`ProgressTracker` et `GameLauncher`. Tous en DOM + CSS, aucun canvas : le
portage est mécanique — composants client, styles inline vers le thème,
minuteries et écouteurs clavier nettoyés au démontage.

**Fini quand** : les six se lancent et se rejouent depuis l'écran d'attente,
sans minuterie survivante après démontage (vérifié en test).

### 7.7 — Un seul chat

`ChatPanel` est monté deux fois — une instance dans `Lobby`, une dans
`GameSession` — et l'historique se perd au passage en manche. Il devient une
instance unique, montée au niveau du provider de 7.1 et affichée dans les
deux écrans.

**Fini quand** : un message envoyé au lobby est encore lisible pendant la
manche, et la borne des 400 caractères est appliquée à la saisie.

### 7.8 — Parcours solo de bout en bout

Brancher entrée solo → écran de génération → manche sur les routes REST de
la phase 4 (`start`, `submit`). La manche utilisée ici est volontairement
minimale — article brut et soumission ; l'article riche, les indices, les
items et le débriefing relèvent de la phase 8, qui la remplace.

**Fini quand** : le test Playwright solo passe — entrer un pseudo, choisir
un sujet, jouer, voir son score.

## Porte de sortie

- Une partie solo se joue de bout en bout.
- Plus aucune prop socket dans l'arbre, plus de handle impératif.
- Le chat survit au passage lobby → manche.

## Invariants concernés

Voir `01-contrat-a-preserver.md` : autorité de l'hôte (les refus `not_host`
viennent du serveur, le client ne fait que masquer les contrôles),
robustesse du transport (pseudo validé et encodé, chat borné à 400
caractères), et les assertions négatives — l'écran de génération ne reçoit
que le **nombre** de paragraphes falsifiés, jamais les positions.

## Pièges

- **Ne pas recréer la socket.** Le provider vit dans un layout qui survit
  aux navigations du groupe `(game)` ; posé trop bas, chaque écran rouvrira
  la connexion et le serveur verra des reconnexions fantômes.
- Les minijeux vivent de `setInterval` et d'écouteurs globaux : un portage
  qui oublie un nettoyage fait fuir l'écran d'attente, pas le minijeu.
- La tentation de porter le handle de `WaitingScreen` « juste pour
  l'instant » : c'est précisément ce que 7.5 supprime, ne pas le réintroduire
  pour gagner une heure.
- Ne pas anticiper la phase 8 : la manche de 7.8 est nue, et c'est voulu.
