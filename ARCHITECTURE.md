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

Tests :

```bash
make test                     # backend (pytest)
cd frontend && npm test       # frontend (vitest)
cd frontend && npm run smoke  # rendu serveur de l'arbre complet
```

## Le principe qui structure tout le reste

**Le serveur est la seule autorité, et la solution ne le quitte pas avant la
fin de la manche.**

Concrètement :

- Le payload de démarrage (`game_start`, `POST /api/game/start`) contient
  l'article et le *nombre* de paragraphes falsifiés — jamais lesquels, ni les
  explications, ni les indices.
- Le score est calculé par le serveur à partir de son propre état. Le client
  n'envoie que sa sélection de paragraphes.
- Les indices sont facturés à l'appel et livrés par le serveur.
- La correction complète arrive avec `game_end` / la réponse de
  `POST /api/game/submit`.

Toute évolution qui renverrait la solution ou un calcul de score au client
casse ce principe. Plusieurs tests le verrouillent explicitement
(`test_solution_hidden.py`, `test_score_integrity.py`, et côté front les
assertions négatives du smoke test).

## Backend — `backend/`

FastAPI. `main.py` ne fait qu'exposer `app` ; tout le reste vit sous `src/`.

| Dossier / module | Rôle |
|---|---|
| `src/core/` | Le jeu lui-même : scraping Wikipédia, génération des fausses infos par LLM, vérification des réponses, fact-checking des signalements. Sans dépendance au web. |
| `src/core/settings.py` | Toutes les limites réglables : seuils de paragraphe, bornes de recherche, timeout HTTP, tailles max de pseudo et de chat. Surchargeables par variable d'environnement. |
| `src/api/` | Les routes HTTP, une par domaine (`game`, `rooms`, `flags`, `health`) + `static_files` qui sert le front buildé. |
| `src/realtime/` | Le multijoueur WebSocket : `room` (état + validation des pseudos), `handlers` (une fonction par type de message + table de dispatch), `broadcast`, `items`, `scoring`, `themes`, `ws` (l'endpoint). |
| `src/app.py` | `create_app()` : assemble les routers puis le montage statique. |
| `src/game.py` | `generate_game(category)` — génération **sans état**. Une instance partagée mémorisait auparavant la dernière partie, et deux joueurs simultanés s'écrasaient. |
| `src/scoring.py` | **Le barème**, partagé par le solo et le multijoueur. `realtime/scoring.py` le réexporte et n'ajoute que le classement. |
| `src/solo.py` | Sessions solo côté serveur : article, départ du chrono, indices payés. Le solo en a besoin pour la même raison que le multijoueur — sans état serveur, la solution ne peut pas rester cachée. |
| `src/log.py` | `get_logger(__name__)`. Pas de `print` dans le code applicatif. |

L'état des salles et des sessions solo est **en mémoire** : redémarrer le
serveur vide les parties en cours, et le service doit tourner en un seul
process (`--workers 1`).

### Routes HTTP

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/ping` | Sonde de vie |
| `POST` | `/api/multiplayer/create` | Crée une salle → `{room_code}` |
| `POST` | `/api/game/start` | Partie solo → `{session_id, …}`, **sans la solution** |
| `POST` | `/api/game/hint` | Achète un indice (niveau 1 ou 2), facturé serveur |
| `POST` | `/api/game/scan` | Item Détecteur : le serveur désigne un paragraphe |
| `POST` | `/api/game/submit` | Corrige et **livre la solution** |
| `POST` | `/api/flag-report` | Signale une erreur factuelle réelle |

## Frontend — `frontend/`

Vite + React 18, **modules ES**. Pas de state manager : l'état descend en props
depuis `app/App.jsx`, sauf les préférences, qui passent par un contexte.

| Dossier | Rôle |
|---|---|
| `src/config.js` | Constantes de jeu partagées (durée, barème, palettes). |
| `src/lib/` | Adaptateurs sans UI : `api` (REST), `ws` (socket + hook d'abonnement), `article` (modèle de l'article), `sound`. |
| `src/app/` | `App.jsx` — bascule lobby ↔ partie, détient la session. `SettingsContext.jsx` — préférences du joueur, persistées en localStorage. |
| `src/components/ui/` | Atomes présentationnels réutilisables. |
| `src/features/*/` | Une fonctionnalité par dossier : `lobby`, `game`, `items`, `waiting`, `chat`, `flag`, `leaderboard`, `debrief`. |
| `src/styles/` | Un fichier par domaine, importés par `main.jsx`. |
| `src/test/` | `setup.js` — bouchons jsdom des tests unitaires. |

### Trois règles à tenir

1. **Aucun `window.*` pour communiquer entre modules.** Une ancienne version
   passait l'article par `window.WIKIFAKE_BODY` et la fin de chargement par
   `window.__waitingScreenReady`. Tout passe par des props, des contextes ou
   des refs impératives.

2. **L'article est un seul objet**, construit par `lib/article.js` :
   `{ title, subtitle, infobox, body, fakes, totalFakes }`. `body` est une
   liste de blocs, chaque paragraphe une liste de segments (texte, lien, ou
   *token* cliquable).

   **`fakes` est vide pendant la manche** : le client ne sait pas quels
   paragraphes sont falsifiés. `withSolution(article, positions)` replie la
   correction reçue à la fin et retourne un nouvel objet — il ne mute pas
   l'article d'origine.

3. **L'état de jeu ne vit pas dans les préférences.** La phase de manche
   (`playing` / `results`) est un état React local de `GameSession`. Le
   contexte de préférences ne contient que ce qui n'influence aucune règle :
   palette, mode expert, affichage des curseurs et du classement. Un panneau
   de maquettage hébergeait auparavant les deux, avec un sélecteur d'écran
   cliquable en pleine partie.

### Vérifier le front

```bash
cd frontend
npm test        # unités : hooks, modèle d'article, appels API, composants
npm run build   # les modules se lient
npm run smoke   # les composants se rendent vraiment (react-dom/server)
```

Le smoke test attrape ce que le build ne voit pas : une prop renommée d'un côté
d'une frontière de feature. Il contient aussi des assertions **négatives** —
aucun paragraphe saboté dans le DOM pendant la manche, aucun panneau de
maquettage, aucune étiquette de session factice.

## Le protocole WebSocket

`/ws/{room_code}/{player_name}`. Le pseudo est validé (longueur, caractères) et
un pseudo déjà utilisé par un joueur connecté est refusé.

Entrants, gérés dans `realtime/handlers.py` :

`set_ready`, `get_lobby`, `force_start`, `submit_theme`, `force_pick`,
`start_game`, `live_score`, `cursor`, `chat_message`, `use_item`,
`unlock_hint`, `submit_answer`, `unsubmit_answer`.

`force_start`, `force_pick` et `start_game` sont **réservés à l'hôte**, vérifié
côté serveur (`Player.is_host`) ; les autres joueurs reçoivent
`{"type": "error", "code": "not_host"}`. Les options de manche (durée, items)
ne sont appliquées que si l'émetteur est l'hôte.

Sortants :

`lobby_update`, `theme_vote_start`, `theme_vote_update`, `theme_selected`,
`game_start`, `live_score_update`, `cursor_update`, `chat_message`,
`items_distributed`, `item_effect`, `item_used`, `hint_unlocked`,
`scanner_result`, `game_end`, `error`.

### Le barème

`src/scoring.py` fait foi, pour le solo comme pour le multijoueur.

Côté front, `features/game/useScore.js` **ne calcule plus les détections** — il
n'en a pas les moyens, puisqu'il ignore la solution. `finalStats` recompose
l'affichage du débriefing à partir du barème renvoyé par le serveur.
`useLiveScore` reste un affichage optimiste pendant la manche : il compte
délibérément chaque marque comme correcte, pour qu'on ne puisse pas lire la
solution dans le score d'un adversaire.

## Déploiement

Image Docker multi-étages (`Dockerfile`) : le front est buildé dans un étage
Node, puis copié dans l'image Python à `frontend/dist`, que `static_files.py`
sert. Render injecte `$PORT`.

```bash
docker build -t wikifake .
docker run -p 8000:8000 -e GEMINI_API_KEY=... wikifake
```
