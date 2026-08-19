# Architecture

WikiFake est un jeu de détection de fausses informations : le backend récupère
un article Wikipédia, une IA y injecte des erreurs factuelles, et les joueurs
doivent les retrouver — seuls ou à plusieurs, en se sabotant avec des items.

## Démarrer

```bash
make build       # venv + deps backend, build du front, puis lancement
make run         # build du front + serveur          → http://localhost:8000
make back        # serveur seul (front déjà buildé)
make front-dev   # Vite avec HMR sur :5173, proxy /api et /ws vers :8000
make test        # tests backend
```

Le front a besoin de `npm` : `cd frontend && npm install` (fait
automatiquement par `make front` / `make run`).

En dev, travaillez avec **deux terminaux** : `make back` d'un côté,
`make front-dev` de l'autre, et ouvrez `http://localhost:5173`.

## Backend — `backend/`

FastAPI. `main.py` ne fait qu'exposer `app` ; tout le reste vit sous `src/`.

| Dossier | Rôle |
|---|---|
| `src/core/` | Le jeu lui-même : scraping Wikipédia, génération des fausses infos par LLM, vérification des réponses, fact-checking des signalements. Sans dépendance au web. |
| `src/api/` | Les routes HTTP, une par domaine (`game`, `rooms`, `flags`, `health`) + `static_files` qui sert le front buildé. |
| `src/realtime/` | Le multijoueur WebSocket : `room` (état), `handlers` (une fonction par type de message + table de dispatch), `broadcast`, `items`, `scoring`, `themes`, `ws` (l'endpoint). |
| `src/app.py` | `create_app()` : assemble les routers puis le montage statique. |
| `src/game.py` | L'instance `FakeNewsGame` partagée entre `api/` et `realtime/`. |

L'état des salles est en mémoire (`realtime/room.rooms`) : redémarrer le
serveur vide les parties en cours.

## Frontend — `frontend/`

Vite + React 18, **modules ES**. Pas de state manager : l'état descend en props
depuis `app/App.jsx`.

| Dossier | Rôle |
|---|---|
| `src/config.js` | Constantes de jeu partagées (durée, barème, palettes). |
| `src/lib/` | Adaptateurs sans UI : `api` (REST), `ws` (socket + hook d'abonnement), `article` (modèle de l'article), `sound`. |
| `src/app/` | `App.jsx` — bascule lobby ↔ partie, détient la session. |
| `src/components/ui/` | Atomes présentationnels réutilisables. |
| `src/features/*/` | Une fonctionnalité par dossier : `lobby`, `game`, `items`, `waiting`, `chat`, `flag`, `leaderboard`, `debrief`. |
| `src/styles/` | Un fichier par domaine, importés par `main.jsx`. |
| `src/vendor/tweaks/` | Panneau de prototypage tiers, invisible en jeu normal. |

### Deux règles à tenir

1. **Aucun `window.*` pour communiquer entre modules.** L'ancienne version
   passait l'article par `window.WIKIFAKE_BODY` et la fin de chargement par
   `window.__waitingScreenReady`. Tout passe désormais par des props, des
   contextes de session ou des refs impératives.
2. **L'article est un seul objet**, construit par `lib/article.js` :
   `{ title, subtitle, infobox, body, fakes }`. `body` est une liste de blocs,
   chaque paragraphe une liste de segments (texte, lien, ou *token* cliquable).
   C'est le seul format que connaissent les composants de jeu.

### Vérifier le front

```bash
cd frontend
npm run build   # les modules se lient
npm run smoke   # les composants se rendent vraiment (react-dom/server)
```

Le smoke test attrape ce que le build ne voit pas : une prop renommée d'un côté
d'une frontière de feature.

## Le protocole WebSocket

`/ws/{room_code}/{player_name}`. Messages entrants gérés dans
`realtime/handlers.py` : `set_ready`, `get_lobby`, `force_start`,
`submit_theme`, `force_pick`, `start_game`, `live_score`, `cursor`,
`chat_message`, `use_item`, `submit_answer`, `unsubmit_answer`.

Sortants : `lobby_update`, `theme_vote_start`, `theme_vote_update`,
`theme_selected`, `game_start`, `live_score_update`, `cursor_update`,
`chat_message`, `items_distributed`, `item_effect`, `item_used`, `game_end`,
`error`.

Le barème est appliqué **des deux côtés** : `realtime/scoring.py` fait foi,
`features/game/useScore.js` en est le miroir pour l'affichage immédiat. Les
deux lisent les mêmes constantes (`SCORING` côté front) — si vous changez le
barème, changez les deux.
