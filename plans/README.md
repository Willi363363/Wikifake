# plans/

Toute la documentation du projet vit ici. Rien à la racine sauf `README.md` et
`CLAUDE.md`, et **aucun fichier de plus de 200 lignes** — un hook le vérifie.

## Par où commencer

| Vous voulez… | Lisez |
|---|---|
| savoir comment on travaille | `methode/00-cycle-de-dev.md` |
| créer une branche, ouvrir une PR | `methode/01-flux-git.md` |
| savoir ce qui est interdit | `methode/02-regles-du-depot.md` |
| comprendre les environnements et les verrous | `methode/03-infrastructure.md` |
| comprendre le code actuel | `etat-des-lieux/` |
| savoir où va le projet | `refonte/00-vue-densemble.md` |
| **savoir ce qu'on ne doit jamais casser** | `refonte/01-contrat-a-preserver.md` |
| travailler maintenant | la fiche de la phase en cours, ci-dessous |

## Où en est le projet

La refonte remplace intégralement la stack : Python et FastAPI disparaissent au
profit d'un monorepo TypeScript. Onze phases, dans cet ordre — chacune dépend
de la précédente sauf mention contraire dans sa fiche.

| # | Phase | État | Fiche |
|---|---|---|---|
| 0 | Fondations — monorepo et outillage | **en cours** | `refonte/phase-00-fondations.md` |
| 1 | Socle — `protocol` et `domain` | à faire | `refonte/phase-01-socle.md` |
| 2 | Données — Drizzle et Postgres | à faire | `refonte/phase-02-donnees.md` |
| 3 | Article — Wikipédia et modèle | à faire | `refonte/phase-03-article.md` |
| 4 | API et authentification | à faire | `refonte/phase-04-api-et-auth.md` |
| 5 | Temps réel — WebSocket et Redis | à faire | `refonte/phase-05-temps-reel.md` |
| 6 | Design system | à faire | `refonte/phase-06-design-system.md` |
| 7 | Front — lobby et attente | à faire | `refonte/phase-07-front-lobby.md` |
| 8 | Front — la manche | à faire | `refonte/phase-08-front-manche.md` |
| 9 | Observabilité et CI/CD | à faire | `refonte/phase-09-observabilite-et-cicd.md` |
| 10 | Bascule — suppression du Python | à faire | `refonte/phase-10-bascule.md` |

**Ce tableau est le seul endroit qui dit où l'on en est.** Il se met à jour
quand une phase change d'état. Les étapes se cochent dans la fiche de phase.

La phase 10 a une condition d'entrée non négociable : chaque garantie de
`refonte/01-contrat-a-preserver.md` et
`refonte/02-contrat-transport-et-conformite.md` doit avoir un test équivalent
dans la nouvelle stack. Tant qu'il en manque une, le Python reste.

## Structure

```
plans/
├── methode/          comment on travaille — à lire une fois, à respecter toujours
├── etat-des-lieux/   ce qui existe aujourd'hui, et la dette connue
└── refonte/          où l'on va : vue d'ensemble, contrat, une fiche par phase
```

## Règles de cette documentation

- 200 lignes maximum par fichier. Au-delà, on découpe.
- La doc se met à jour **dans la PR qui change le comportement**, pas après.
- Pas de fichier de suivi parallèle. Pas de `TODO.md`, pas de `NOTES.md` : ils
  divergent en une semaine et mentent en deux.
- Un problème découvert hors périmètre se note dans
  `etat-des-lieux/05-dette-connue.md` et ne se corrige pas sur place.
