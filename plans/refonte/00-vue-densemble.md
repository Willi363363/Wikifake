# Refonte — vue d'ensemble

Ce document rassemble le cadre de la refonte : les décisions arrêtées, le
point de départ mesuré, l'architecture cible, la stratégie de test, les risques
et le découpage en phases. Le détail de chaque phase vit dans sa fiche
`phase-NN-<sujet>.md`. L'avancement vit dans `plans/README.md`, et nulle part
ailleurs.

Le document le plus important du dossier n'est pas celui-ci : c'est le contrat
à préserver, réparti entre `01-contrat-a-preserver.md` et
`02-contrat-transport-et-conformite.md`.

## Décisions arrêtées

| Sujet | Décision |
|---|---|
| Runtime | TypeScript de bout en bout, monorepo Turborepo + pnpm |
| Front | Next.js 16 (App Router, RSC), React 19 |
| API | Route Handlers Next.js + Hono pour le temps réel, Zod comme unique source de vérité des contrats |
| Temps réel | Service WebSocket auto-hébergé + Redis (état des salles, pub/sub, planification) |
| Persistance | Postgres Neon + Drizzle ORM ; Upstash Redis pour l'éphémère |
| Hébergement | Vercel (web) + Fly.io (temps réel) + Neon + Upstash |
| Périmètre | Iso-fonctionnel + comptes, persistance, historique, statistiques |
| Design | Tailwind v4 + shadcn/ui, identité visuelle actuelle transcrite en thème |
| LLM | Vercel AI SDK + AI Gateway, Gemini par défaut, `generateObject` validé par Zod ; LangChain disparaît |
| Auth | Better Auth dans le Postgres du projet |
| Méthode | Big bang sur `willi363/refonte`, une PR finale ; le Python est supprimé en phase 10 |
| Langue | Code et identifiants en anglais, documentation et UI en français, commits conventionnels en français |

Ce qui disparaît de la stack : Python 3.10, FastAPI, uvicorn, LangChain,
`wikipedia`, BeautifulSoup, pytest, Vite, le JavaScript non typé, le CSS
global à la main, les ~430 objets `style={{}}`, le Docker mono-container,
Render, `complaints.jsonl`, et tout l'état en mémoire.

## Point de départ mesuré

- Backend : 4 339 lignes de Python, 14 modules sous `backend/src/`,
  15 fichiers de tests.
- Frontend : 8 442 lignes, zéro TypeScript, 2 dépendances runtime (react,
  react-dom), ~1 300 lignes de CSS global et ~430 objets de style inline.
- **Zéro base de données.** Tout l'état vit dans la RAM d'un process unique :
  registre des salles, sessions solo, cache d'articles, compteurs d'usage. Un
  redémarrage vide les parties en cours ; une seconde instance casse tout.
- Seule persistance disque : `backend/data/complaints.jsonl`, éphémère sur
  Render free.

## Architecture cible

```
wikifake/
├── apps/
│   ├── web/            # Next.js 16 — UI, auth, API REST, pages SEO
│   └── realtime/       # WebSocket Node — Hono + ws + Redis + BullMQ
├── packages/
│   ├── protocol/       # ★ source unique des contrats : Zod (WS + REST)
│   ├── domain/         # ★ règles pures : barème, correction, FSM salle, items
│   ├── db/             # Drizzle : schéma, migrations, requêtes
│   ├── article/        # scraping Wikipédia + falsification LLM + cache
│   ├── ui/             # design system Tailwind + shadcn
│   └── config/         # tsconfig, eslint, tailwind preset partagés
├── turbo.json
└── pnpm-workspace.yaml
```

Les deux paquets marqués ★ sont la raison d'être de la refonte : ils
suppriment **structurellement** les duplications de vérité de l'existant
(barème en double back/front, identifiants d'items synchronisés à la main,
deux formes de `players` dans `game_start`, constantes redéclarées en dur).

- **`packages/protocol`** — tout message WebSocket et tout DTO REST est un
  schéma Zod exporté : le serveur valide en entrée, le client infère ses types
  du même objet, les codes d'erreur forment une union fermée, et la
  documentation du protocole est générée depuis les schémas.
- **`packages/domain`** — règles pures, sans I/O ni horloge implicite : barème
  et breakdown, correction des réponses, catalogue et effets d'items,
  sélection de thème, et la machine à états de salle en réducteur
  `(state, event) → {state, effects}`, testable sans WebSocket ni Redis ni
  LLM.
- **`apps/web`** — Next.js 16 : pages marketing statiques, lobby et manche,
  compte et historique, routes API (health, usage, game, rooms, flag-report,
  auth).
- **`apps/realtime`** — WebSocket multi-instances : état des salles dans Redis
  muté par scripts Lua, diffusion par pub/sub, minuteries BullMQ (fin de
  manche par timeout, vagues d'items, TTL de salle), reconnexion à jeton de
  session. Déployé sur Fly.io — Vercel n'héberge pas de WebSocket long-vivant.
- **`packages/article`** — API MediaWiki + cheerio (l'invariant de parité
  d'index se joue là), falsification par `generateObject` validé Zod, cache
  Redis partagé entre instances.
- **`packages/db`** — schéma Drizzle : auth, profils, salles, parties,
  `game_position` (la solution, jamais exposée avant la fin), participants,
  réponses, achats d'indices, usages d'items, signalements, `llm_call` (le
  coût par partie devient une requête).
- **`packages/ui`** — thème Tailwind v4 depuis les tokens actuels, primitives
  shadcn, composant token à variantes, `prefers-reduced-motion`, mode sombre,
  responsive, accessibilité clavier.

## Stratégie de test

- **Unitaire (Vitest)** — `domain` et `protocol` : barème, correction,
  réducteur, validation des messages. Tout ce qui est pur, donc l'essentiel
  des règles.
- **Fixtures HTML** — `article` : parité d'index, déduplication, normalisation
  des espaces, injection, sur de vraies pages Wikipédia gelées.
- **Intégration** (Testcontainers ou branche Neon + Redis local) — API, base,
  cache, facturation des indices, isolation des sessions.
- **Protocole** — client WebSocket de test contre `apps/realtime` :
  autorisation d'hôte, refus d'homonyme, survie au JSON invalide, throttles,
  reconnexion, fin de manche par timeout, deux instances sur une même salle.
- **E2E (Playwright)** — deux navigateurs dans une même salle : parcours
  complet, et les **assertions négatives** — aucun paragraphe saboté dans le
  DOM pendant la manche, aucune explication, attribution CC BY-SA présente
  avant et après. C'est l'héritage le plus important des tests actuels.
- **Verrou documentaire** — la doc du protocole est générée depuis les schémas
  Zod ; le test échoue si le fichier commité diverge du généré.

## Risques

| Risque | Effet | Traitement |
|---|---|---|
| Parité d'index texte ↔ DOM au portage cheerio | Le joueur noté sur les mauvais paragraphes — le bug historique du projet | Phase 3 tôt, fixtures réelles, test de parité avant toute autre chose |
| `generateObject` change le comportement du modèle | Falsifications de qualité différente, plus ou moins subtiles | Prompt repris textuellement ; comparaison sur un jeu de catégories fixe avant d'y toucher |
| Redis + Lua pour l'état de salle | Complexité supérieure au dict en mémoire | Le réducteur reste pur et testé hors Redis ; Redis n'applique que des transitions déjà décidées |
| Deux hébergeurs (Vercel + Fly) | Surface d'exploitation, CORS et origines WebSocket à tenir | Origines et jetons explicites dès la phase 5, pas en fin de parcours |
| Volume du front de manche | La manche concentre l'essentiel du front | Découpage interne par feature, chacune livrée avec sa galerie de composants |
| PR finale énorme et non bissectable | Revue difficile | Commits par phase, conventional-commits en français, message de PR structuré |
| Régression silencieuse d'une garantie du contrat | Une garantie payée par un bug en production disparaît sans bruit | Le contrat est une liste de contrôle cochée test par test — la porte de la phase 10 |

## Ce qu'on ne fait pas

- Pas de monétisation, pas d'organisations, pas de Stripe : le périmètre
  s'arrête aux comptes, à l'historique et aux statistiques.
- Pas de redesign : l'identité visuelle actuelle est transcrite, pas repensée.
- Pas de changement de modèle LLM dans le même mouvement que le changement de
  stack : Gemini reste par défaut, l'AI Gateway rend la bascule ultérieure
  triviale.
- Pas d'i18n : l'UI est unifiée en français (`lang="fr"` verrouillé par test),
  sans framework de traduction.
- Pas de portage du code mort : CLI, prompt de `core/prompts.py`, composants
  `HintsPanel` et `Leaderboard` en variante sidebar, `get_feedback`.

## Les onze phases

L'avancement de ces phases se lit dans `plans/README.md`, pas ici.

| Phase | Titre | Fichier |
|---|---|---|
| 0 | Fondations | `phase-00-fondations.md` |
| 1 | Socle (`protocol` + `domain`) | `phase-01-socle.md` |
| 2 | Données | `phase-02-donnees.md` |
| 3 | Article | `phase-03-article.md` |
| 4 | API et auth | `phase-04-api-et-auth.md` |
| 5 | Temps réel | `phase-05-temps-reel.md` |
| 6 | Design system | `phase-06-design-system.md` |
| 7 | Front lobby | `phase-07-front-lobby.md` |
| 8 | Front manche | `phase-08-front-manche.md` |
| 9 | Observabilité et CI/CD | `phase-09-observabilite-et-cicd.md` |
| 10 | Bascule | `phase-10-bascule.md` |
