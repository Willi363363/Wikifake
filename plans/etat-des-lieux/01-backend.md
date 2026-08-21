# État des lieux — backend (`backend/`)

FastAPI. `main.py` ne fait qu'exposer `app` ; tout le reste vit sous `src/`.

## Les modules

| Dossier / module | Rôle |
|---|---|
| `src/core/` | Le jeu lui-même : scraping Wikipédia, génération des fausses infos par LLM, vérification des réponses, fact-checking des signalements. Sans dépendance au web. |
| `src/core/settings.py` | Toutes les limites réglables : seuils de paragraphe, bornes de recherche, timeout HTTP, tailles max de pseudo et de chat. Surchargeables par variable d'environnement. |
| `src/api/` | Les routes HTTP, une par domaine (`game`, `rooms`, `flags`, `health`) + `static_files` qui sert le front buildé. |
| `src/realtime/` | Le multijoueur WebSocket : `room` (état + validation des pseudos), `handlers` (une fonction par type de message + table de dispatch), `broadcast`, `items`, `scoring`, `themes`, `ws` (l'endpoint). |
| `src/app.py` | `create_app()` : assemble les routers puis le montage statique. |
| `src/game.py` | `generate_game(category)` — génération **sans état**, servie par le cache quand c'est possible. Une instance partagée mémorisait auparavant la dernière partie, et deux joueurs simultanés s'écrasaient. |
| `src/article_cache.py` | Cache des articles falsifiés. Chaque partie régénérait tout depuis zéro : c'était le premier poste de coût, et les dix secondes d'attente au lancement. Interface réduite à `get` / `put` pour qu'un stockage partagé (Redis, Postgres) s'y substitue en un seul fichier. |
| `src/usage.py` | Compteurs d'appels au modèle, exposés par `/api/usage`. Sans mesure, impossible de savoir ce que coûte une partie. |
| `src/scoring.py` | **Le barème**, partagé par le solo et le multijoueur. `realtime/scoring.py` le réexporte et n'ajoute que le classement. |
| `src/solo.py` | Sessions solo côté serveur : article, départ du chrono, indices payés. Le solo en a besoin pour la même raison que le multijoueur — sans état serveur, la solution ne peut pas rester cachée. |
| `src/log.py` | `get_logger(__name__)`. Pas de `print` dans le code applicatif. |
| `src/version.py` | `VERSION`, tenue à la main. Exposée par `/api/health` pour repérer d'un coup d'œil ce qui tourne en production. |

L'état des salles et des sessions solo est **en mémoire** : redémarrer le
serveur vide les parties en cours, et le service doit tourner en un seul
process (`--workers 1`).

## Routes HTTP

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/ping` | Sonde de vie, minimale (répartiteurs de charge) |
| `GET` | `/api/health` | Version, commit déployé, modèle — voir `04-deploiement.md` |
| `GET` | `/api/usage` | Consommation du modèle et efficacité du cache |
| `POST` | `/api/multiplayer/create` | Crée une salle → `{room_code}` |
| `POST` | `/api/game/start` | Partie solo → `{session_id, …}`, **sans la solution** |
| `POST` | `/api/game/hint` | Achète un indice (niveau 1 ou 2), facturé serveur |
| `POST` | `/api/game/scan` | Item Détecteur : le serveur désigne un paragraphe |
| `POST` | `/api/game/submit` | Corrige et **livre la solution** |
| `POST` | `/api/flag-report` | Signale une erreur factuelle réelle |

## Fonctionnement

Deux parcours entrent dans le jeu :

- **Solo** : `POST /api/game/start` crée une session serveur (`src/solo.py`)
  et renvoie l'article sans la solution. Le joueur peut acheter des indices
  (`POST /api/game/hint`, facturé serveur), déclencher le Détecteur
  (`POST /api/game/scan`), puis soumettre sa sélection
  (`POST /api/game/submit`), qui corrige, calcule le score depuis l'état
  serveur et livre la solution complète.
- **Multijoueur** : `POST /api/multiplayer/create` renvoie un `{room_code}`,
  puis tout passe par le WebSocket — voir `03-protocole-websocket.md`.

Dans les deux cas la génération d'article (`src/game.py`) est sans état et
sert depuis le cache (`src/article_cache.py`) quand c'est possible ; le barème
unique vit dans `src/scoring.py`, et chaque appel au modèle est compté par
`src/usage.py`.
