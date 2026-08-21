# WikiFake

Jeu de détection de fausses informations. Le serveur récupère un article
Wikipédia, un modèle de langage y injecte des erreurs factuelles, et les
joueurs doivent les retrouver — seuls ou à plusieurs, en se sabotant avec des
items.

Le principe qui structure tout le reste : **le serveur est la seule autorité,
et la solution ne le quitte pas avant la fin de la manche.**

## Démarrer

Le projet migre vers un monorepo TypeScript. Les deux stacks coexistent
jusqu'à la phase 10 ; voir [`plans/README.md`](plans/README.md).

### Monorepo (la cible)

```bash
nvm use                 # Node 22, fixé par .nvmrc
corepack enable pnpm    # si besoin : npm i -g corepack@latest d'abord
pnpm install
```

Puis `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format`.

> Le Corepack livré avec Node 20 a des clés de signature périmées et échoue sur
> `Cannot find matching keyid` : mettez-le à jour avant de l'activer.

### Stack actuelle (Python + Vite)

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
