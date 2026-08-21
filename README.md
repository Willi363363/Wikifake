# WikiFake

Jeu de détection de fausses informations. Le serveur récupère un article
Wikipédia, un modèle de langage y injecte des erreurs factuelles, et les
joueurs doivent les retrouver — seuls ou à plusieurs, en se sabotant avec des
items.

Le principe qui structure tout le reste : **le serveur est la seule autorité,
et la solution ne le quitte pas avant la fin de la manche.**

## Démarrer

```bash
make hooks     # installer les hooks git — une fois par clone
make build     # dépendances backend, build du front, puis lancement
make run       # build du front + serveur         → http://localhost:8000
make front-dev # Vite avec HMR sur :5173, proxy /api et /ws vers :8000
make test      # tests backend
make check     # contrôles de conformité du dépôt
```

En développement, deux terminaux : `make back` d'un côté, `make front-dev` de
l'autre, puis `http://localhost:5173`.

Il faut une clé Google AI Studio dans `.env` — voir `backend/.env.example`.

## Documentation

Tout est dans **[`plans/`](plans/README.md)**. Trois entrées :

- **`plans/methode/`** — comment on travaille : phases et étapes, flux git,
  règles du dépôt. À lire avant de contribuer.
- **`plans/etat-des-lieux/`** — comment le code actuel fonctionne.
- **`plans/refonte/`** — où va le projet, phase par phase.

Les agents lisent `CLAUDE.md` à la racine, qui pointe vers ces documents et
rappelle les règles non négociables.

## État du projet

Le projet entre dans une refonte complète de sa stack : Python et FastAPI
laissent la place à un monorepo TypeScript. L'avancement est suivi dans
[`plans/README.md`](plans/README.md).
