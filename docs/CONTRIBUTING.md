# Contribuer

## Avant de commencer

```bash
make install
make check     # doit passer avant toute PR
```

## Règles structurantes

1. **Un fichier = une responsabilité.** Si un fichier dépasse ~300 lignes,
   c'est le signal qu'il faut le découper.
2. **Une donnée = une source.** Avant d'ajouter une constante, chercher si
   elle existe déjà (`shared/items.json`, `backend/app/config.py`,
   `app/rooms/scoring.py`, les deux `protocol`).
3. **Pas d'état global.** Côté frontend, rien sur `window`. Côté backend,
   pas de singleton mutable partagé entre parties.
4. **Le serveur décide.** Tout ce qui influence le score est calculé par le
   backend à partir de son propre état.
5. **Pas d'appel bloquant dans une coroutine.** Réseau ou LLM →
   `asyncio.to_thread`.

## Ajouter une commande WebSocket

1. Déclarer le nom dans `backend/app/ws/protocol.py` (`ClientMessage`).
2. Écrire le handler dans `backend/app/ws/handlers/<domaine>.py` :

```python
@handler(ClientMessage.MA_COMMANDE, host_only=False, states=(RoomState.PLAYING,))
async def ma_commande(ctx: HandlerContext, payload: dict) -> None:
    await ctx.service.quelque_chose(ctx.room, ctx.player, payload.get("x"))
```

3. Si c'est un nouveau module, l'ajouter à `ws/handlers/__init__.py`.
4. Refléter le nom dans `frontend/src/net/protocol.js`.
5. Ajouter un test dans `backend/tests/integration/test_websocket.py`.

Aucun `if/elif` à modifier : le dispatcher se fonde sur le registre.

## Ajouter un item

1. Une entrée dans `shared/items.json` (le backend et le frontend lisent
   ce même fichier).
2. Si l'item a un effet visuel : un composant dans
   `frontend/src/features/effects/` puis une entrée dans `registry.js`.
   Le test `config/__tests__/items.test.js` échoue si vous l'oubliez.
3. Si l'item touche au score ou au temps : traiter son `id` dans
   `RoomService._apply_effect` — c'est le seul endroit où un effet de jeu
   est appliqué.

## Ajouter un mode de jeu

Écrire un adaptateur dans `frontend/src/state/engines.js` respectant
l'interface documentée en tête du fichier. `GameScreen` fonctionne à
l'identique sans modification.

## Conventions

- **Langue** : code et identifiants en anglais, commentaires, docstrings et
  textes d'interface en français.
- **Python** : `ruff` (configuré dans `pyproject.toml`), annotations de
  types sur les signatures publiques, `logging` — jamais `print`.
- **JavaScript** : `eslint`, composants en `PascalCase.jsx`, hooks en
  `useXxx.js`, imports absolus via `@/`.
- **CSS** : une feuille par domaine dans `src/styles/`, classes plutôt que
  styles inline pour tout ce qui est statique.
- **Exceptions** : jamais de `except:` ni de `catch {}` muet ; attraper un
  type précis et journaliser.

## Tests attendus

| Changement | Test minimum |
|---|---|
| formule ou barème | `backend/tests/unit/test_scoring.py` |
| génération / falsification | `backend/tests/unit/test_builder.py` |
| commande WebSocket | `backend/tests/integration/test_websocket.py` |
| route HTTP | `backend/tests/integration/test_http_api.py` |
| hook ou composant | un fichier dans le `__tests__/` du dossier concerné |
