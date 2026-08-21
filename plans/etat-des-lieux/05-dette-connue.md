# État des lieux — dette connue

**Ce fichier est le registre de la dette.** Tout problème découvert en chemin
— pendant la refonte, une revue ou un débogage — se note ici avec sa référence
`fichier:ligne`, **sans le corriger** au passage : la correction a lieu dans la
phase de refonte qui la concerne, pas en aparté.

## Les dix défauts vérifiés en production

1. **La feature items est cassée en multijoueur.**
   `frontend/src/features/game/GameSession.jsx:376` passe `onUse={useItem}`
   alors que `useItem` n'est ni importé ni défini — `ReferenceError` au rendu
   de toute manche avec `withItems`. Et rien n'appelle jamais `setItemModal`,
   donc la chaîne « clic sur un item → choix de la cible → `use_item` » n'a
   pas d'entrée. Le smoke test ne l'attrape pas : il rend avec
   `withItems: false`.

2. **Les pénalités fuient d'une manche à l'autre.**
   `backend/src/realtime/themes.py:101-106` ne réinitialise que
   `score/answered/results/ready/items`, tandis que
   `backend/src/realtime/handlers.py:128` appelle `reset_round()` qui purge en
   plus `hint_levels`, `score_stolen`, `hints_blocked_until`, `scanned`. Le
   chemin par vote de thème — le chemin normal — laisse donc traîner les
   pénalités d'indices et les vols de score. `test_score_integrity.py` ne le
   voit pas : il teste `reset_round()` en isolation, jamais le chemin réel.

3. **Deux chemins de démarrage divergents.** `handle_start_game`
   (`backend/src/realtime/handlers.py:118`) génère l'article **de façon
   synchrone sur l'event loop** (bloque toutes les salles pendant le
   scraping + LLM) et annonce `players` comme une liste de pseudos
   (`handlers.py:146`) ; `start_game_in_room`
   (`backend/src/realtime/themes.py:93`) génère dans un thread et annonce des
   objets `{name, color}` (`themes.py:123`). Le client doit accepter les deux
   formes.

4. **Le serveur n'impose jamais la fin de manche.** `time_limit` n'est
   appliqué que par le client — le serveur ne s'en sert que pour le bonus
   temps (`backend/src/realtime/handlers.py:371`). Si le dernier joueur
   non-soumis se déconnecte, la salle reste en `playing` indéfiniment. Aucun
   TTL de salle non plus : une salle inactive vit pour toujours.

5. **Le chemin de reconnexion est mort.**
   `backend/src/realtime/ws.py:58-65` prévoit de récupérer un joueur dont
   `connected` est `False`, mais rien ne met jamais ce champ à `False` — la
   déconnexion supprime le joueur (`ws.py:117`). Score, items et indices payés
   sont perdus, et le pseudo est immédiatement reprenable par un tiers.

6. **Entrées WebSocket non validées.** `live_score`
   (`backend/src/realtime/handlers.py:152`) n'est ni validé ni throttlé et est
   rebroadcasté à toute la salle : vecteur d'amplification. Les `targets` d'un
   `use_item` (`handlers.py:229`) ne sont pas validés (auto-ciblage, nombre de
   cibles libre). `set_ready` accepte un `time_limit` de l'hôte **en pleine
   manche** (`handlers.py:56-57`), ce qui change le bonus temps des
   soumissions suivantes.

7. **`FREEZE_TIME` n'a aucun effet serveur.** L'item est déclaré
   (`backend/src/realtime/items.py:14`) mais `_apply_scoring_effect`
   (`backend/src/realtime/handlers.py:219-222`) ne traite que `SCORE_STEAL` et
   `HINT_LOCK` : les −10 s sont purement visuels et n'entament pas le bonus
   temps. L'item ne fait rien de ce qu'il annonce.

8. **Duplications de vérité.** Le barème existe deux fois
   (`backend/src/scoring.py` et `frontend/src/config.js`). Les identifiants
   d'items sont synchronisés à la main entre `backend/src/realtime/items.py`
   et `frontend/src/features/items/catalog.js`. `MIN_FALSIFIABLE_CHARS`
   (`backend/src/core/settings.py:59`) est redéclaré en dur dans
   `backend/src/core/misinformation.py:14` (`MIN_PARAGRAPH_LENGTH = 100`).
   `backend/src/core/prompts.py` est du code mort : le vrai prompt de
   falsification est inline dans `misinformation.py`.

9. **Fuites côté client.** Les curseurs des joueurs partis ne sont jamais
   retirés de l'état (`frontend/src/features/game/useLiveCursors.js`).
   `useHints` se réinitialise sur `totalFakes`
   (`frontend/src/features/game/useHints.js:33`), ce qui ne fonctionne que
   parce que `GameSession` est démonté entre les manches.

10. **Le pseudo n'est pas encodé** dans l'URL du WebSocket
    (`frontend/src/lib/ws.js:13`) alors que la regex serveur autorise les
    espaces.

## Les `print()` restants dans `backend/src/core/`

La règle du dépôt est « pas de `print` dans le code applicatif »
(`src/log.py`). Cinq survivent dans `backend/src/core/` :

- `backend/src/core/settings.py:26` — avertissement quand deux fichiers
  `.env` coexistent.
- `backend/src/core/misinformation.py:119` — indices LLM incohérents avec la
  requête, association par position.
- `backend/src/core/misinformation.py:193` — paragraphes manquants, nouvelle
  tentative.
- `backend/src/core/flag_verifier.py:40` — échec de la recherche Wikipédia.
- `backend/src/core/flag_verifier.py:108` — erreur de vérification LLM.
