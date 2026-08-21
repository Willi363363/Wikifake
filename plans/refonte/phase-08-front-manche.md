# Phase 8 — Front de manche

| | |
|---|---|
| **État** | à faire |
| **Branche** | `feat/refonte-phase-8` |
| **Dépend de** | phase 7 |
| **Livre** | la manche complète, du premier paragraphe au débriefing |

## Objectif

Porter la manche : article et sélection de paragraphes, indices, effets
visuels, curseurs live, classement, débriefing, signalement — et
**reconstruire** les items, cassés en production. C'est la phase la plus
volumineuse du projet : un domaine par étape, chacun livrable seul.

## Pourquoi maintenant

Tout est prêt en dessous : le contexte WebSocket et le chat (phase 7), le
protocole et les règles pures (phase 1), le temps réel (phase 6). La manche
concentre l'essentiel du front — c'est le risque de volume identifié en §7
du plan, et son traitement est ce découpage : une feature à la fois.

## Étapes

### 8.1 — Article et sélection de paragraphes

`GameSession` recomposé, `ArticleCard`, `ArticleBody`, `ArticleToken`,
`Brief`, `TopBar`, `Footer`, minuterie. `ArticleToken` devient un élément
interactif focusable (rôle, clavier) — c'est le geste central du jeu.
L'attribution CC BY-SA (« texte volontairement modifié » + licence + lien)
est visible pendant la manche. Index de paragraphes en base 1, comme au
contrat.

**Fini quand** : sélection et désélection fonctionnent au clic et au
clavier, et l'assertion négative passe — aucun texte original, aucune
explication, aucune position dans le DOM pendant la manche.

### 8.2 — Indices

`IntelOverlay`, `HintLockedNotice`, `useHints` (`HintsPanel` est mort, il
n'est pas porté). Les niveaux sont demandés au serveur et affichés tels que
reçus — monotones, facturés une fois. `useHints` ne se réinitialise plus sur
`totalFakes`, ce qui ne marchait que parce que `GameSession` était démonté
entre les manches : la clé devient l'identifiant de manche.

**Fini quand** : acheter le niveau 2 puis redemander le niveau 1 affiche le
niveau 2 sans refacturation, et `hints_blocked` s'affiche sans crash.

### 8.3 — Items : reconstruction

Pas un portage : `GameSession.jsx:376` passe `onUse={useItem}` alors que
`useItem` n'est ni importé ni défini — `ReferenceError` au rendu de toute
manche multijoueur avec items — et rien n'appelle jamais `setItemModal`,
donc la chaîne « clic sur un item → choix de la cible → `use_item` » n'a
pas d'entrée. On repart des composants (`ItemBar`, `ItemCard`,
`ItemTargetModal`, `ItemNotification`) et du catalogue unique de
`packages/protocol`, et on écrit la chaîne d'usage entière : clic, ciblage
si l'item en demande un, envoi, réception des effets.

**Fini quand** : chaque item du catalogue s'utilise en multijoueur, cibles
validées par le serveur, et les tests de rendu passent `withItems: true` —
le smoke actuel rendait avec `withItems: false`, c'est ainsi que le bug a
survécu.

### 8.4 — Les huit effets visuels

Blackout, Blizzard, Confetti, Earthquake, Fog, Lightning, Rickroll, Static,
plus `useItemEffects`. Deux corrections au passage : les particules tirées
par `Math.random()` dans des `useMemo` de rendu (hydratation non
déterministe) sont générées après montage, côté client seulement ; et
`Static` — le seul canvas du projet, bruit TV dessiné pixel par pixel à
~25 i/s, le portage le plus délicat — garde son `requestAnimationFrame`
nettoyé et lit les dimensions dans l'effet, jamais au render.
`prefers-reduced-motion` neutralise secousses et flashs.

**Fini quand** : chaque effet se déclenche et s'éteint sur son message
serveur, aucun avertissement d'hydratation, `reduced-motion` vérifié en
test.

### 8.5 — Curseurs live

`useLiveCursors`, `PlayerCursor`. Deux fuites fermées : `window.innerWidth`
lu au render (`GameSession.jsx:348`) — les positions restent des fractions
`[0,1]` converties en `%` CSS, aucune lecture de fenêtre au render ; et les
curseurs des joueurs partis, aujourd'hui jamais retirés de l'état, sont
purgés au message de départ.

**Fini quand** : un joueur qui quitte voit son curseur disparaître chez les
autres, et le composant se rend sans toucher à `window`.

### 8.6 — Classement en direct

`FloatingLeaderboard` (la variante sidebar morte n'est pas portée),
alimenté par `live_score`, tri par score décroissant, envoi cadencé côté
client en plus du throttle serveur de la phase 6.

**Fini quand** : quatre joueurs voient le même ordre, et l'envoi de
`live_score` est throttlé des deux côtés.

### 8.7 — Débriefing

`Debrief` et `AnimatedRanking`. La révélation des statistiques est
aujourd'hui un `setTimeout` de 5 400 ms accordé « à l'oreille » sur la
séquence d'environ 5,1 s d'`AnimatedRanking` : le séquencement devient un
seul ordonnanceur — l'animation signale sa fin, le débriefing enchaîne. La
solution (positions, explications) ne s'affiche que depuis `game_end`, et
l'attribution CC BY-SA reste visible après la manche.

**Fini quand** : ralentir l'animation ne désynchronise plus la révélation,
et l'assertion d'attribution passe sur l'écran de fin.

### 8.8 — Signalement d'erreur factuelle

`FlagButton`, `FlagCaptureModal`, `FlagReportForm`, `FlagToast`, branchés
sur `POST /api/flag-report` (phase 4), verdict du modèle affiché.

**Fini quand** : un signalement soumis apparaît en base (`flag_report`) et
le toast reflète le verdict.

### 8.9 — Bout en bout multijoueur

Le test Playwright de référence : quatre navigateurs dans une salle, vote
de thème, manche avec items, débriefing. Les assertions négatives tournent
pendant la manche, sur chaque client.

**Fini quand** : la partie à 4 se joue de bout en bout, items compris, et
les assertions négatives passent sur les quatre clients.

## Porte de sortie

- Une partie multijoueur à 4 se joue de bout en bout, items compris.
- Les assertions négatives passent pendant la manche, sur tous les clients.
- L'attribution CC BY-SA est visible pendant **et** après la manche.
- Aucun avertissement d'hydratation sur les écrans de manche.

## Invariants concernés

Voir `01-contrat-a-preserver.md` : la solution ne quitte pas le serveur —
jamais dans le DOM pendant la manche, vérifié par les assertions négatives
(aucun texte original, aucune explication, aucune position avant
`game_end`), par clés **et par valeurs** ; l'attribution CC BY-SA, exigence
légale testée, pendant et après la manche ; le barème et le catalogue
d'items viennent de `packages/domain` et `packages/protocol`, jamais
redéclarés côté front.

## Pièges

- **Le DOM fuit plus facilement qu'avant.** Avec les Server Components, un
  objet passé du serveur au client est sérialisé dans la page : la solution
  ne doit jamais transiter par des props RSC. D'où les assertions par
  valeurs, pas seulement par clés.
- `Static` est coûteux — un `createImageData` plein écran 25 fois par
  seconde. Client-only, animation nettoyée, coupé sous
  `prefers-reduced-motion` : l'enjeu de photosensibilité est réel.
- Le bug des items a vécu parce que rien ne rendait la manche avec items :
  tout test de cette phase qui les touche rend `withItems: true`.
- Les minuteries en cascade (débriefing, effets à durée) se testent avec
  des horloges factices, jamais avec des attentes réelles.
- Quatre navigateurs Playwright, c'est lent et fragile : un seul parcours
  en 8.9, court ; tout le reste se teste par domaine, sans navigateur.
