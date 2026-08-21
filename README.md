# WikiFake

Jeu de détection de fausses informations. Le serveur récupère un article
Wikipédia réel, y injecte discrètement des faits faux à l'aide d'un LLM, et
les joueurs doivent retrouver les paragraphes falsifiés — seuls ou à
plusieurs, avec des items pour se gêner mutuellement.

## Démarrage rapide

```bash
git clone <url> && cd Hackathon-GenAI
make install                 # venv Python + npm + .env
# renseignez OPENAI_API_KEY dans .env
make dev                     # http://localhost:5173
```

| Commande | Effet |
|---|---|
| `make install` | Installe backend, frontend et crée `.env` |
| `make dev` | Backend `:8000` + Vite avec rechargement à chaud `:5173` |
| `make serve` | Build du frontend puis tout servi sur `:8000` |
| `make test` | Tests Python **et** JavaScript |
| `make lint` | ruff + eslint |
| `make check` | Ce que vérifie la CI |
| `make` | Liste toutes les commandes |

Sans `OPENAI_API_KEY`, le serveur démarre et l'interface s'affiche ; seule la
génération d'articles échoue, avec un message explicite.

## Architecture

```
shared/items.json         SOURCE UNIQUE du catalogue d'items (backend + frontend)
backend/
  app/
    main.py               création de l'app (câblage uniquement)
    config.py             SOURCE UNIQUE des constantes, tout surchargeable par env
    api/                  une route = un fichier
    ws/
      protocol.py         SOURCE UNIQUE des noms de messages
      dispatcher.py       routage par table + garde `host_only`
      handlers/           une famille de commandes = un fichier
    rooms/                salles, joueurs, items, score, orchestration
    game/                 Wikipédia → paragraphes → falsification → GameData
    flags/                signalements d'erreurs réelles
  tests/{unit,integration}
frontend/
  src/
    config/               constantes, catalogue, palettes
    lib/                  son, formatage, calculs partagés
    net/                  api.js, socket.js, protocol.js
    state/                contextes et hooks d'état
    ui/                   design system (composants sans logique métier)
    features/<domaine>/   lobby, waiting, game, items, effects, debrief, flags, chat
    styles/               une feuille par domaine
```

Aucun fichier ne dépasse **420 lignes** ; la médiane est autour de 80.

## Où intervenir

| Je veux… | Fichier(s) à toucher |
|---|---|
| ajouter un item | `shared/items.json` + `frontend/src/features/effects/registry.js` |
| changer la formule de score | `backend/app/rooms/scoring.py` |
| changer un prompt | `backend/app/game/prompts.py` |
| ajouter une commande WebSocket | `backend/app/ws/protocol.py` + un fichier dans `ws/handlers/` + `frontend/src/net/protocol.js` |
| ajouter une route HTTP | un fichier `backend/app/api/routes_*.py` + `api/__init__.py` |
| ajouter un mini-jeu d'attente | un fichier dans `frontend/src/features/waiting/minigames/` + son `index.js` |
| ajouter un effet visuel | `frontend/src/features/effects/` + `registry.js` |
| changer un réglage (durée, seuils, coûts) | `backend/app/config.py` ou une variable dans `.env` |
| ajouter un écran | `frontend/src/features/<domaine>/` + une branche dans `src/App.jsx` |
| ajouter un mode de jeu | un adaptateur dans `frontend/src/state/engines.js` — `GameScreen` n'a pas à changer |

Détails du protocole réseau : [`docs/PROTOCOL.md`](docs/PROTOCOL.md).
Guide de contribution et conventions : [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).

## Principes de conception

1. **Le serveur est la seule autorité.** Il calcule les scores, décompte les
   indices, applique les malus, borne la durée. Le client n'envoie que sa
   sélection de paragraphes.
2. **La solution ne quitte pas le serveur avant la fin.** Le payload de
   démarrage ne contient ni les indices des paragraphes falsifiés, ni les
   explications.
3. **Une seule source par donnée.** Le catalogue d'items, la formule de
   score, les noms de messages et les durées existent chacun en un seul
   endroit.
4. **Un fichier, une responsabilité.** Les composants de présentation ne
   font pas de réseau ; les hooks d'état ne font pas de rendu.

## Tests

```bash
make test           # tout
make test-backend   # 102 tests pytest
make test-frontend  # 50 tests vitest
```

Aucun test n'appelle OpenAI ni Wikipédia : la génération est systématiquement
remplacée par une fabrique locale (`backend/tests/conftest.py`).

## Déploiement

```bash
make frontend-build
uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
```

Le backend sert `frontend/dist`. Les salles vivent en mémoire : un seul
process (`--workers 1`). Pour passer à l'échelle, remplacer `RoomStore` et
`api/rate_limit.py` par un stockage partagé (Redis).
