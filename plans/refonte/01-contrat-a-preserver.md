# Le contrat à préserver — 1/2

> Autorité serveur, barème, génération d'article, défauts connus. La suite —
> cache et comptabilité, transport, conformité, identité du déploiement,
> verrou documentaire — est dans `02-contrat-transport-et-conformite.md`.

C'est le document le plus important du dépôt. Les tests actuels ne sont pas de
la couverture décorative : chaque garantie ci-dessous verrouille une
non-régression qui a coûté un bug en production. **Chaque garantie doit avoir
un test équivalent dans la nouvelle stack avant que le Python ne soit
supprimé** — c'est la condition d'entrée de la phase 10 (bascule). Le Python
reste tant qu'une seule ligne n'a pas d'équivalent testé.

Les identifiants (`C1.1`, `C2.3`, …) sont stables et citables : les fiches de
phase y renvoient, et une garantie ne change jamais de numéro.

## Index des sections

| Id | Section | Fichier |
|---|---|---|
| C1 | Autorité serveur | ce fichier |
| C2 | Le barème | ce fichier |
| C3 | Génération d'article | ce fichier |
| D | Défauts connus à corriger | ce fichier |
| C4 | Cache et comptabilité | `02-contrat-transport-et-conformite.md` |
| C5 | Robustesse du transport | `02-contrat-transport-et-conformite.md` |
| C6 | Conformité CC BY-SA et indexation | `02-contrat-transport-et-conformite.md` |
| C7 | Identité du déploiement | `02-contrat-transport-et-conformite.md` |
| C8 | Verrou documentation ↔ code | `02-contrat-transport-et-conformite.md` |

## C1 — Autorité serveur : la solution ne quitte pas le serveur

- **C1.1** — Le payload de départ (`game_start`, `POST /api/game/start`)
  contient l'article et le **nombre** de paragraphes falsifiés. Jamais
  lesquels, jamais les explications, jamais les indices, jamais
  `original_text` (un diff suffisait à résoudre la partie). Vérification par
  clés **et par valeurs** : aucun texte de vérité ni d'indice ne doit
  apparaître dans le JSON sérialisé.
- **C1.2** — La solution complète arrive avec `game_end` / la réponse de
  `POST /api/game/submit`, jamais avant.
- **C1.3** — Le score est calculé par le serveur depuis son propre état. Les
  pénalités déclarées par le client sont ignorées : `hintsUsed: 9`,
  `hintPenalty: 9999`, `scoreStolen: -100000` doivent produire un breakdown à
  zéro.
- **C1.4** — Les indices sont facturés à l'appel, niveaux **monotones** et
  facturés une seule fois : niveau 2 débloqué puis niveau 1 redemandé renvoie
  le niveau 2 ; répéter le niveau 2 ne refacture pas. Le texte d'un indice
  n'est jamais transmis avant paiement.
- **C1.5** — Le vol de score et le blocage d'indices sont appliqués serveur.
  `HINT_LOCK` refuse l'achat avec `code: hints_blocked` et `hint_levels` reste
  vide.
- **C1.6** — L'item SCANNER est résolu par le serveur : il désigne un vrai
  faux non encore désigné, mémorisé par joueur, et renvoie `null` quand il
  n'en reste plus.
- **C1.7** — Le rôle d'hôte est décidé et vérifié serveur. `force_start`,
  `force_pick`, `start_game` renvoient `code: not_host` à un invité, sans
  changer l'état de la salle. Un invité change son `ready` mais pas
  `time_limit` ni `with_items`.
- **C1.8** — Au départ de l'hôte, le joueur suivant est promu. La salle
  disparaît quand le dernier joueur part.

## C2 — Le barème

- **C2.1** — `score = tp×150 − fp×80 − hint_penalty − score_stolen + time_bonus`
  avec `time_bonus = max(0, time_limit − elapsed) × 0,5`, `HINT_COST = 50`,
  `REVEAL_COST = 200`, `STEAL_AMOUNT = 50`.
- **C2.2** — Le coût des indices est **non cumulatif** (le niveau 2 coûte 200
  au total, pas 250) et monotone.
- **C2.3** — Le score peut être négatif. Pas de bonus temps au-delà du délai.
- **C2.4** — Leaderboard trié par score décroissant.
- **C2.5** — Cas de référence à conserver en test : `tp=3, fp=1, pénalité=20,
  volé=50, 200 s restants sur 300 → 400`.

## C3 — Génération d'article

- **C3.1** — **`positions` désigne exactement les paragraphes que le LLM a
  modifiés.** C'était le bug le plus grave de l'histoire du projet : les
  positions étaient tirées au hasard et le joueur était noté sur les mauvais
  paragraphes.
- **C3.2** — Parité d'index stricte : `paragraphs[i]` correspond au i-ème nœud
  `<p>` collecté. Toute la chaîne repose là-dessus.
- **C3.3** — `false_info_number` séquentiels de 1 à n, `positions` triées par
  index croissant, index **base 1** dans le contrat client.
- **C3.4** — Paragraphes dédupliqués (variantes mobile/desktop de Wikipédia),
  ordre du document préservé, paragraphes de moins de 50 caractères écartés.
- **C3.5** — Espaces insérés entre balises inline (`un<b>deux</b>trois` →
  « un deux trois ») mais ponctuation non décollée (« 1889. » pas « 1889 . »).
- **C3.6** — Le générateur est **sans état** : deux parties concurrentes ne se
  mutent pas.
- **C3.7** — Wikipédia introuvable → échec propre, pas d'exception, pas de
  mise en cache.

## D — Défauts connus à corriger pendant la refonte

L'envers du contrat : des bugs vérifiés, présents aujourd'hui en production,
que la refonte doit fermer — pas reproduire. Ils ne sont pas des dommages
collatéraux de la migration.

- **D1** — La feature items est cassée en multijoueur :
  `frontend/src/features/game/GameSession.jsx:376` passe `onUse={useItem}`
  alors que `useItem` n'est ni importé ni défini — `ReferenceError` au rendu
  de toute manche avec `withItems` — et rien n'appelle jamais `setItemModal`.
  Le smoke test ne l'attrape pas : il rend avec `withItems: false`. À
  reconstruire, pas à porter.
- **D2** — Les pénalités fuient d'une manche à l'autre : le chemin par vote de
  thème — le chemin normal — ne purge pas `hint_levels`, `score_stolen`,
  `hints_blocked_until`, `scanned`, contrairement à `reset_round()`.
  `test_score_integrity.py` ne le voit pas : il teste `reset_round()` en
  isolation. Un seul chemin de démarrage de manche dans la cible.
- **D3** — Deux chemins de démarrage divergents : `handle_start_game` génère
  l'article en synchrone sur l'event loop (bloque toutes les salles) et
  annonce `players` en liste de pseudos ; `start_game_in_room` génère dans un
  thread et annonce des objets `{name, color}`. Le client doit accepter les
  deux formes.
- **D4** — Le serveur n'impose jamais la fin de manche : `time_limit` n'est
  appliqué que par le client ; si le dernier joueur non-soumis se déconnecte,
  la salle reste en `playing` indéfiniment. Aucun TTL de salle non plus.
- **D5** — Le chemin de reconnexion est mort : rien ne met jamais `connected`
  à `False`, la déconnexion supprime le joueur. Score, items et indices payés
  sont perdus, et le pseudo est immédiatement reprenable par un tiers.
- **D6** — `live_score` n'est ni validé ni throttlé et est rebroadcasté à
  toute la salle : vecteur d'amplification. Les `targets` d'un `use_item` ne
  sont pas validés (auto-ciblage, nombre de cibles libre). `set_ready` accepte
  un `time_limit` de l'hôte en pleine manche, ce qui change le bonus temps des
  soumissions suivantes.
- **D7** — `FREEZE_TIME` n'a aucun effet serveur : les −10 s sont purement
  visuels et n'entament pas le bonus temps. L'item ne fait rien de ce qu'il
  annonce.
- **D8** — Duplications de vérité : le barème existe deux fois
  (`backend/src/scoring.py` et `frontend/src/config.js`), les identifiants
  d'items sont synchronisés à la main, `MIN_FALSIFIABLE_CHARS` est redéclaré
  en dur dans `misinformation.py`, et `backend/src/core/prompts.py` est du
  code mort — le vrai prompt est inline dans `misinformation.py`.
- **D9** — Fuites côté client : les curseurs des joueurs partis ne sont jamais
  retirés de l'état ; `useHints` se réinitialise sur `totalFakes`, ce qui ne
  tient que parce que `GameSession` est démonté entre les manches.
- **D10** — Le pseudo n'est pas encodé dans l'URL du WebSocket alors que la
  regex serveur autorise les espaces.

La suite du contrat — C4 à C8 — est dans
`02-contrat-transport-et-conformite.md`.
