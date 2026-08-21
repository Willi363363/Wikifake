# État des lieux — vue d'ensemble

WikiFake est un jeu de détection de fausses informations : le backend récupère
un article Wikipédia, une IA y injecte des erreurs factuelles, et les joueurs
doivent les retrouver — seuls ou à plusieurs, en se sabotant avec des items.

Cette série de documents décrit **l'existant**, tel qu'il tourne en production :

- `01-backend.md` — les modules et les routes HTTP.
- `02-frontend.md` — les dossiers du front et les règles à tenir.
- `03-protocole-websocket.md` — le protocole temps réel et le barème.
- `04-deploiement.md` — l'image Docker, Render et la sonde de déploiement.
- `05-dette-connue.md` — les défauts vérifiés, avec leurs références.

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

## Tout l'état vit en mémoire, dans un process unique

L'état des salles et des sessions solo est **en mémoire** : redémarrer le
serveur vide les parties en cours, et le service doit tourner en un seul
process (`--workers 1`). Il n'y a aucune base de données : registre des
salles, sessions solo, cache d'articles et compteurs d'usage vivent dans la
RAM du process. Une seconde instance casse tout. La seule persistance disque
est `backend/data/complaints.jsonl`, éphémère sur Render free.

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

## Volumétrie

- Backend : 4 339 lignes de Python, 14 modules sous `backend/src/`,
  15 fichiers de tests.
- Frontend : 8 442 lignes, zéro TypeScript, 2 dépendances runtime (react,
  react-dom), ~1 300 lignes de CSS global et ~430 objets de style inline.
