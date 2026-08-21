# Refonte WikiFake — plan de migration

> Document de travail. Décrit la cible, le contrat à préserver, et le découpage
> de la refonte complète. `ARCHITECTURE.md` décrit l'existant et sera réécrit
> au lot 12.

## 1. Décisions arrêtées

| Sujet | Décision |
|---|---|
| Runtime | **TypeScript de bout en bout**, monorepo Turborepo + pnpm |
| Front | **Next.js 16** (App Router, RSC), React 19 |
| API | Route Handlers Next.js + **Hono** pour le service temps réel, **Zod** comme unique source de vérité des contrats |
| Temps réel | **Service WebSocket auto-hébergé + Redis** (état des salles, pub/sub, planification) |
| Persistance | **Postgres Neon** + **Drizzle ORM** ; **Upstash Redis** pour l'éphémère |
| Hébergement | **Vercel** (web) + **Fly.io** (temps réel) + Neon + Upstash |
| Périmètre | Iso-fonctionnel **+ comptes, persistance, historique, statistiques** |
| Design | **Tailwind v4 + shadcn/ui**, identité visuelle actuelle transcrite en thème |
| LLM | **Vercel AI SDK** + AI Gateway, Gemini par défaut, `generateObject` validé par Zod. LangChain disparaît |
| Auth | **Better Auth** dans le Postgres du projet |
| Méthode | **Big bang sur `willi363/refonte`**, une PR finale. Le Python est supprimé au lot 12 |
| Langue | Code et identifiants en anglais, documentation et UI en français, commits conventional-commits en français (convention actuelle conservée) |

Ce qui disparaît : Python 3.10, FastAPI, uvicorn, LangChain, `wikipedia`, BeautifulSoup,
pytest, Vite, JavaScript non typé, le CSS global à la main, les ~430 objets
`style={{}}`, Docker mono-container, Render, `complaints.jsonl`, tout l'état en mémoire.

---

## 2. Point de départ mesuré

- Backend : 4 339 lignes de Python, 14 modules sous `backend/src/`, 15 fichiers de tests.
- Frontend : 8 442 lignes, **zéro TypeScript**, 2 dépendances runtime (react, react-dom),
  ~1 300 lignes de CSS global et ~430 objets de style inline.
- Zéro base de données. Tout l'état vit dans la RAM d'un process unique :
  registre des salles, sessions solo, cache d'articles, compteurs d'usage.
  Un redémarrage vide les parties en cours. Une seconde instance casse tout.
- Seule persistance disque : `backend/data/complaints.jsonl`, éphémère sur Render free.

### 2.1 Bugs vérifiés à corriger pendant la refonte

Ils ne sont pas des dommages collatéraux de la migration : ils existent aujourd'hui
en production, et la refonte est l'occasion de les fermer.

1. **La feature items est cassée en multijoueur.** `frontend/src/features/game/GameSession.jsx:376`
   passe `onUse={useItem}` alors que `useItem` n'est ni importé ni défini — `ReferenceError`
   au rendu de toute manche avec `withItems`. Et rien n'appelle jamais `setItemModal`,
   donc la chaîne « clic sur un item → choix de la cible → `use_item` » n'a pas d'entrée.
   Le smoke test ne l'attrape pas : il rend avec `withItems: false`.
   → À reconstruire, pas à porter.

2. **Les pénalités fuient d'une manche à l'autre.** `backend/src/realtime/themes.py:101-106`
   ne réinitialise que `score/answered/results/ready/items`, tandis que
   `handlers.py:128` appelle `reset_round()` qui purge en plus `hint_levels`,
   `score_stolen`, `hints_blocked_until`, `scanned`. Le chemin par vote de thème —
   le chemin normal — laisse donc traîner les pénalités d'indices et les vols de
   score. `test_score_integrity.py` ne le voit pas : il teste `reset_round()` en
   isolation, jamais le chemin réel.
   → Un seul chemin de démarrage de manche dans la cible.

3. **Deux chemins de démarrage divergents.** `handle_start_game` génère l'article
   **de façon synchrone sur l'event loop** (bloque toutes les salles pendant le
   scraping + LLM) et annonce `players` comme une liste de pseudos ;
   `start_game_in_room` génère dans un thread et annonce des objets `{name, color}`.
   Le client doit accepter les deux formes.

4. **Le serveur n'impose jamais la fin de manche.** `time_limit` n'est appliqué que
   par le client. Si le dernier joueur non-soumis se déconnecte, la salle reste en
   `playing` indéfiniment. Aucun TTL de salle non plus : une salle inactive vit pour
   toujours.

5. **Le chemin de reconnexion est mort.** `ws.py` prévoit de récupérer un joueur
   dont `connected` est `False`, mais rien ne met jamais ce champ à `False` — la
   déconnexion supprime le joueur. Score, items et indices payés sont perdus, et
   le pseudo est immédiatement reprenable par un tiers.

6. **`live_score` n'est ni validé ni throttlé** et est rebroadcasté à toute la salle :
   vecteur d'amplification. Les `targets` d'un `use_item` ne sont pas validés
   (auto-ciblage, nombre de cibles libre). `set_ready` accepte un `time_limit` de
   l'hôte **en pleine manche**, ce qui change le bonus temps des soumissions suivantes.

7. **`FREEZE_TIME` n'a aucun effet serveur** : les −10 s sont purement visuels et
   n'entament pas le bonus temps. L'item ne fait rien de ce qu'il annonce.

8. **Duplications de vérité.** Le barème existe deux fois (`backend/src/scoring.py`
   et `frontend/src/config.js`). Les identifiants d'items sont synchronisés à la main
   entre `backend/src/realtime/items.py` et `frontend/src/features/items/catalog.js`.
   `MIN_FALSIFIABLE_CHARS` (settings) est redéclaré en dur dans `misinformation.py`.
   `backend/src/core/prompts.py` est du code mort : le vrai prompt de falsification
   est inline dans `misinformation.py`.

9. **Fuites côté client** : les curseurs des joueurs partis ne sont jamais retirés
   de l'état. `useHints` se réinitialise sur `totalFakes`, ce qui ne fonctionne que
   parce que `GameSession` est démonté entre les manches.

10. **Le pseudo n'est pas encodé** dans l'URL du WebSocket alors que la regex
    serveur autorise les espaces.

---

## 3. Le contrat à préserver

Les tests actuels ne sont pas de la couverture décorative : ils verrouillent des
non-régressions qui ont chacune coûté un bug en production. **Chaque ligne de cette
section doit avoir un test équivalent dans la cible avant que le Python ne soit
supprimé.** C'est le critère de sortie du lot 12.

### 3.1 Autorité serveur — la solution ne quitte pas le serveur

- Le payload de départ (`game_start`, `POST /api/game/start`) contient l'article et
  le **nombre** de paragraphes falsifiés. Jamais lesquels, jamais les explications,
  jamais les indices, jamais `original_text` (un diff suffisait à résoudre la partie).
  Vérification par clés **et par valeurs** : aucun texte de vérité ni d'indice ne doit
  apparaître dans le JSON sérialisé.
- La solution complète arrive avec `game_end` / la réponse de `POST /api/game/submit`.
- Le score est calculé par le serveur depuis son propre état. Les pénalités déclarées
  par le client sont ignorées (`hintsUsed: 9`, `hintPenalty: 9999`, `scoreStolen: -100000`
  doivent produire un breakdown à zéro).
- Les indices sont facturés à l'appel, niveaux **monotones** et facturés une seule fois :
  niveau 2 débloqué puis niveau 1 redemandé renvoie niveau 2 ; répéter le niveau 2 ne
  refacture pas. Le texte d'un indice n'est jamais transmis avant paiement.
- Le vol de score et le blocage d'indices sont appliqués serveur. `HINT_LOCK` refuse
  l'achat avec `code: hints_blocked` et `hint_levels` reste vide.
- L'item SCANNER est résolu par le serveur : il désigne un vrai faux non encore
  désigné, mémorisé par joueur, et renvoie `null` quand il n'en reste plus.
- Le rôle d'hôte est décidé et vérifié serveur. `force_start`, `force_pick`,
  `start_game` renvoient `code: not_host` à un invité, sans changer l'état de la salle.
  Un invité change son `ready` mais pas `time_limit` ni `with_items`.
- Au départ de l'hôte, le joueur suivant est promu. La salle disparaît quand le
  dernier joueur part.

### 3.2 Le barème

`score = tp×150 − fp×80 − hint_penalty − score_stolen + time_bonus`
avec `time_bonus = max(0, time_limit − elapsed) × 0,5`, `HINT_COST = 50`,
`REVEAL_COST = 200`, `STEAL_AMOUNT = 50`. Le coût des indices est **non cumulatif**
(niveau 2 coûte 200 au total, pas 250) et monotone. Le score peut être négatif.
Pas de bonus temps au-delà du délai. Leaderboard trié par score décroissant.
Cas de référence à conserver en test : `tp=3, fp=1, pénalité=20, volé=50,
200 s restants sur 300 → 400`.

### 3.3 Génération d'article

- **`positions` désigne exactement les paragraphes que le LLM a modifiés.** C'était
  le bug le plus grave de l'histoire du projet : les positions étaient tirées au
  hasard et le joueur était noté sur les mauvais paragraphes.
- Parité d'index stricte : `paragraphs[i]` correspond au i-ème nœud `<p>` collecté.
  Toute la chaîne repose là-dessus.
- `false_info_number` séquentiels de 1 à n, `positions` triées par index croissant,
  index **base 1** dans le contrat client.
- Paragraphes dédupliqués (variantes mobile/desktop de Wikipédia), ordre du document
  préservé, paragraphes de moins de 50 caractères écartés.
- Espaces insérés entre balises inline (`un<b>deux</b>trois` → « un deux trois »)
  mais ponctuation non décollée (« 1889. » pas « 1889 . »).
- Le générateur est **sans état** : deux parties concurrentes ne se mutent pas.
- Wikipédia introuvable → échec propre, pas d'exception, pas de mise en cache.

### 3.4 Cache et comptabilité

- Clés normalisées : « Paris », « paris », «  PARIS  », « PÁRIS » sont une seule
  entrée. Catégorie vide ignorée.
- Entrées **copiées à l'entrée et à la sortie** : muter le résultat d'un `get`
  n'affecte rien d'autre.
- TTL 6 h, 3 variantes par catégorie, 200 catégories en LRU.
- Plusieurs variantes servies en rotation : une même recherche ne sert pas
  éternellement le même article.
- Une génération échouée n'est ni mise en cache ni comptée.
- `cache_hit_rate` et `per_generated_game` (coût par partie réellement générée,
  non dilué par le cache) restent exposés.

### 3.5 Robustesse du transport

- Pseudo validé : non vide, ≤ 24 caractères, `^[\w\-. ]+$`, trimé. Rejets typés
  (`invalid_name`), et le message d'erreur part **avant** la fermeture.
- Homonyme connecté refusé (`name_taken`) sans toucher au joueur en place.
- JSON invalide → `bad_json` et **la connexion survit**. Type inconnu → ignoré.
- Chat borné à 400 caractères, chat vide abandonné.
- Curseurs bornés à `[0,1]` et rate-limités côté serveur.
- Codes de salle uniques sur 6 caractères, création plafonnée (503 au-delà).
- Trames au-delà de 64 000 caractères → fermeture 1009.

### 3.6 Conformité et indexation

- **L'attribution CC BY-SA est une exigence légale testée** : « texte volontairement
  modifié » + licence + lien doivent rester visibles **pendant et après** la manche.
- `robots.txt` : `Disallow /api /ws`, exclusion de GPTBot, ClaudeBot,
  Google-Extended, CCBot — le corpus est faux par construction, il ne doit pas
  entraîner de modèles. Sitemap déclaré.
- `<html lang="fr">`, meta title/description bornées, Open Graph, canonical.

### 3.7 Identité du déploiement

- `GET /ping` répond **exactement** `{"status": "alive"}`.
- `GET /api/health` expose `status`, `version`, `commit` (chaîne **présente même
  vide** en local), `commit_short` (7 caractères), `model`, `llm_configured`
  (booléen). **La clé API n'apparaît jamais.** La sonde CI compare `commit` au SHA
  poussé — ce contrat doit survivre à la migration ou la boucle de vérification de
  déploiement meurt en silence.
- `GET /` répond toujours du HTML 200 avec un `<title>` non vide.

### 3.8 Le verrou documentation ↔ code

`test_architecture_doc.py` vérifie mécaniquement que `ARCHITECTURE.md` ne dérive
pas : les modules cités existent, les cibles `make` existent, la liste des messages
WS entrants documentés **égale** la table de dispatch, chaque sortant documenté est
réellement émis, les routes documentées **égalent** les décorateurs de route.
Ce mécanisme est du Python à base de regex. **Il doit être réimplémenté**, sinon la
garantie disparaît sans bruit — dans la cible il devient trivial et bien plus solide,
puisque le protocole est un objet Zod : la doc se génère depuis le schéma et le test
compare le fichier généré au fichier commité.

---

## 4. Architecture cible

```
wikifake/
├── apps/
│   ├── web/                    # Next.js 16 — UI, auth, API REST, pages SEO
│   │   ├── app/
│   │   │   ├── (marketing)/    # accueil, mentions, licence — statique, RSC
│   │   │   ├── (game)/         # lobby, salle, manche — client boundary explicite
│   │   │   ├── (account)/      # profil, historique, statistiques
│   │   │   └── api/            # health, usage, game/*, rooms, flag-report, auth/*
│   │   └── ...
│   └── realtime/               # service WebSocket Node — Hono + ws + Redis + BullMQ
├── packages/
│   ├── protocol/               # ★ source unique des contrats : Zod (WS + REST)
│   ├── domain/                 # ★ règles pures : barème, correction, FSM salle, items
│   ├── db/                     # Drizzle : schéma, migrations, requêtes
│   ├── article/                # scraping Wikipédia + falsification LLM + cache
│   ├── ui/                     # design system Tailwind + shadcn
│   └── config/                 # tsconfig, eslint, tailwind preset partagés
├── turbo.json
└── pnpm-workspace.yaml
```

Les deux paquets marqués ★ sont la raison d'être de la refonte : ils suppriment
structurellement les duplications de vérité listées en 2.1.8.

### 4.1 `packages/protocol` — le contrat, une fois

Tout message WebSocket et tout DTO REST devient un schéma Zod exporté. Le serveur
valide en entrée, le client infère ses types depuis le même objet. Conséquences
directes :

- Le catalogue d'items est **un** objet ; les identifiants ne peuvent plus diverger entre front et back.
- La divergence de forme de `players` dans `game_start` devient impossible : un seul
  schéma, un seul émetteur.
- La documentation du protocole est **générée** depuis les schémas, et le test de
  dérive documentaire (3.8) compare le généré au commité.
- Les codes d'erreur deviennent une union fermée (`room_not_found`, `invalid_name`,
  `name_taken`, `bad_json`, `not_host`, `hints_blocked`, …) au lieu de chaînes libres.

### 4.2 `packages/domain` — les règles, pures et testées

Fonctions sans I/O, sans horloge implicite (le temps est un paramètre) :
barème et breakdown, pénalité d'indices, correction des réponses, machine à états
de salle sous forme de réducteur `(state, event) → {state, effects}`, catalogue et
effets d'items, sélection de thème.

Le réducteur est le cœur du gain : la machine à états de salle est aujourd'hui
répartie entre `handlers.py`, `themes.py`, `items.py` et `room.py`, avec des gardes
implicites (« message hors phase = ignoré silencieusement ») et deux chemins de
démarrage divergents. En réducteur pur, elle se teste exhaustivement sans WebSocket,
sans Redis et sans LLM — et les transitions manquantes (fin de manche par timeout,
fin de manche à la déconnexion du dernier joueur) deviennent visibles.

### 4.3 `apps/realtime` — WebSocket, Redis, BullMQ

- Transport : `ws` derrière Hono, une instance ou plusieurs.
- État des salles : **Redis**, muté par scripts Lua pour l'atomicité (le réducteur
  décide, le script applique). Aucune instance ne détient la vérité.
- Diffusion : **Redis pub/sub**, canal par salle. N'importe quelle instance sert
  n'importe quelle socket.
- Minuteries : **BullMQ** (jobs différés) pour les vagues d'items, la fin de manche
  par timeout, et le TTL de salle inactive. C'est ce qui ferme les points 2.1.4.
- Reconnexion : jeton de session porté par le client, `connected: false` réellement
  écrit à la déconnexion, fenêtre de grâce avant éviction. Score, items et indices
  payés survivent. Le pseudo n'est pas reprenable pendant la fenêtre.
- Backpressure : diffusion en parallèle avec budget par socket, éviction du socket
  mort au moment de l'échec — aujourd'hui la diffusion est séquentielle et un socket
  lent ralentit toute la salle.
- Throttle serveur sur `cursor` **et** `live_score` (aujourd'hui absent sur le second).

Le service ne va pas sur Vercel : les fonctions n'hébergent pas de WebSocket
long-vivant. Fly.io, même monorepo, déploiement indépendant.

### 4.4 `packages/article` — Wikipédia et LLM

- Scraping : API MediaWiki en direct (recherche, résolution de page sans
  auto-suggestion, HTML rendu), plus **cheerio** pour le DOM. L'invariant de parité
  d'index (3.3) est le point délicat : la collecte des `<p>`, l'extraction du texte
  et l'injection des faux doivent partager les mêmes références de nœuds. Cheerio le
  permet ; c'est le morceau à écrire en premier et à couvrir de tests.
- Langue et user-agent **explicites à chaque appel** : aujourd'hui la bibliothèque
  Python porte un état global, et le vérificateur de signalements interroge
  silencieusement Wikipédia dans une autre langue selon l'ordre des appels.
- Falsification : **`generateObject` de l'AI SDK avec schéma Zod**. Cela supprime
  d'un coup les heuristiques de parsing qui constituent aujourd'hui de la logique
  métier — retrait des clôtures Markdown, repli du premier `[` au dernier `]`,
  déballage d'objet enveloppe, politique tout-ou-rien sur les index renvoyés par le
  modèle, repli positionnel, relance partielle. Environ 130 lignes de robustesse
  remplacées par un schéma.
- Le prompt mort (`core/prompts.py`) n'est pas porté. Le prompt réellement utilisé
  est repris tel quel dans un premier temps, pour ne pas mélanger changement de
  stack et changement de comportement du modèle.
- La troncature à 1 000 caractères des originaux envoyés au modèle est **corrigée** :
  aujourd'hui le paragraphe falsifié renvoyé remplace le paragraphe entier, ce qui
  raccourcit silencieusement les longs paragraphes dans l'article servi.
- Cache : Redis, mêmes règles qu'en 3.4 (normalisation, TTL 6 h, 3 variantes, LRU).
  Il devient partagé entre instances et survit aux redéploiements — deux gains que
  la version en mémoire ne pouvait pas donner.

### 4.5 `packages/db` — le schéma

Postgres via Drizzle. Ce que la base apporte, et que l'état en mémoire interdisait :

| Table | Contenu |
|---|---|
| `user`, `session`, `account`, `verification` | Better Auth |
| `profile` | pseudo affiché, accent préféré, préférences |
| `room` | code, hôte, réglages, état, horodatages |
| `game` | mode (solo/multi), sujet, URL source, instantané de l'article, nombre de faux |
| `game_position` | **la solution** — index, texte faux, texte original, explication, indice. Jamais exposée avant la fin |
| `participant` | joueur d'une partie : compte **ou** invité, couleur, score, tp, fp, indices, pénalité, volé, bonus temps |
| `answer` | paragraphes marqués |
| `hint_purchase` | achat d'indice horodaté, niveau, coût — la facturation devient auditable |
| `item_use` | qui a saboté qui, avec quoi, quand |
| `flag_report` | signalement + verdict du modèle — remplace `complaints.jsonl` |
| `llm_call` | modèle, type d'appel, tokens entrée/sortie, échec — remplace les compteurs volatils de `usage.py` |

`llm_call` mérite un mot : aujourd'hui `/api/usage` repart de zéro à chaque
redémarrage, ce qui interdit toute mesure de coût réelle. En base, le coût par
partie devient une requête.

### 4.6 `packages/ui` — design system

Les tokens actuels de `tokens.css` (palette « papier chaud », cinq accents, ombres,
rayons) sont transcrits dans le thème Tailwind v4. Les primitives viennent de
shadcn/ui. Ce qui compte dans le portage :

- Les ~15 keyframes partagés d'`animations.css` sont référencés **par chaîne** depuis
  les styles inline. Ils deviennent des animations du thème, typées.
- La machine à états visuelle du token (`selected/edited/scanned/hinted/found/missed/
  false-positive`, badges en pseudo-éléments) est le composant le plus chargé en règles
  CSS : il devient un composant à variantes (`cva`), pas une cascade de classes globales.
- Les ~430 objets `style={{}}` disparaissent au profit de classes utilitaires. C'est
  le poste de travail le plus volumineux du front, et le plus mécanique.
- Ajouts non négociables au passage : `prefers-reduced-motion` (le jeu enchaîne
  secousses et flashs stroboscopiques — enjeu de photosensibilité réel), mode sombre,
  et responsive (il y a **une seule** media query dans tout le projet aujourd'hui).
- Accessibilité : les interactions majeures sont des `<span onClick>` et `<div onClick>`
  non focusables — au premier chef `ArticleToken`, qui **est** le geste central du jeu.
  Ils deviennent des éléments interactifs avec rôle, focus visible et clavier.

---

## 5. Découpage

Big bang sur la branche, mais séquencé par lots avec une porte de sortie vérifiable
à chaque fois. L'ordre est contraint par les dépendances : le contrat avant les
règles, les règles avant les services, les services avant l'UI.

| Lot | Contenu | Porte de sortie |
|---|---|---|
| **L0** | Monorepo : pnpm workspaces, Turborepo, tsconfig strict partagé, ESLint, Prettier, Vitest, `.env` typé, Corepack | `pnpm build` et `pnpm test` passent à vide |
| **L1** | `packages/protocol` : tous les schémas Zod, REST et WS. `packages/domain` : barème, correction, catalogue d'items, réducteur de salle | Les cas de 3.2 et 3.3 passent en tests unitaires purs, réducteur couvert transition par transition, y compris les deux qui manquent aujourd'hui |
| **L2** | `packages/db` : schéma Drizzle, migrations, client Neon, seed de développement | `drizzle-kit migrate` sur une base neuve, requêtes typées |
| **L3** | `packages/article` : MediaWiki + cheerio, falsification `generateObject`, cache Redis, compteurs en base | Parité d'index et non-duplication vérifiées sur fixtures HTML réelles ; règles de cache de 3.4 vérifiées |
| **L4** | `apps/web` API : `/ping`, `/api/health`, `/api/usage`, `/api/game/{start,hint,scan,submit}`, `/api/multiplayer/create`, `/api/flag-report` | Tous les invariants de 3.1 sur le solo, contrat `/api/health` de 3.7 conservé au champ près |
| **L5** | Better Auth : comptes, sessions, OAuth, **et session invité rattachable** — on doit pouvoir jouer sans compte | Une partie invité s'attache à un compte créé après coup |
| **L6** | `apps/realtime` : ws + Redis + BullMQ, protocole complet, reconnexion, throttles, fin de manche serveur, TTL de salle | Invariants de 3.1 et 3.5 sur le multijoueur ; une manche survit à une coupure réseau ; deux instances servent une même salle |
| **L7** | `packages/ui` : thème, primitives shadcn, keyframes, composant token, reduced-motion, mode sombre | Galerie de composants rendue, contrastes audités |
| **L8** | Front lobby : entrée solo/hôte/rejoindre, salle, vote de thème, écran d'attente, 6 minijeux, chat | Une partie solo se joue de bout en bout |
| **L9** | Front manche : article, sélection, indices, **items reconstruits** (2.1.1), 8 effets, curseurs, classement, débriefing, signalement | Une partie multijoueur à 4 se joue de bout en bout, items compris |
| **L10** | Observabilité : `/api/health` versionné, tableau de bord d'usage, journalisation structurée, Sentry | Le coût d'une partie est lisible en base |
| **L11** | CI/CD : GitHub Actions (lint, types, tests, build, e2e Playwright), Vercel pour le web, Fly pour le temps réel, portage de la sonde de déploiement, réimplémentation du verrou documentaire (3.8) | CI verte, preview par PR, sonde de déploiement fonctionnelle |
| **L12** | **Suppression du Python** : `backend/`, `main.py`, `pytest.ini`, `Makefile`, `Dockerfile`, `render.yaml`, `requirements.txt`. Réécriture d'`ARCHITECTURE.md` | La grille de §3 est intégralement couverte par des tests de la nouvelle stack. C'est la seule condition de suppression |

Le lot 12 ne se négocie pas à l'avance : le Python reste tant qu'une ligne de §3
n'a pas d'équivalent testé.

---

### 5.1 Prérequis outillage

Relevé sur la machine de développement : Node **20.18.3**, npm 10.8.2, Docker 29.7.2,
`gh` 2.98.0. pnpm était absent ; il est installé en **10.34.5** via Corepack.

Deux points à trancher au lot 0 :

- **Corepack livré avec Node 20.18.3 est cassé** (clés de signature du registre
  périmées, `Cannot find matching keyid`). Il faut le mettre à jour
  (`npm i -g corepack@latest`) avant tout `corepack prepare`. À documenter dans le
  README, sinon chaque personne de l'équipe y perdra une demi-heure.
- **pnpm 11 exige Node ≥ 22.13** (il charge `node:sqlite`). D'où le choix de pnpm 10
  en local. La cible raisonnable pour un monorepo neuf est **Node 22 LTS**, fixé par
  un `.nvmrc` à la racine et par `engines` dans le `package.json` : cela débloque
  pnpm 11 et aligne le runtime local sur Vercel et Fly. Le passage de Node 20 à 22
  sur les postes de l'équipe est une décision à prendre explicitement au lot 0, pas
  une dérive silencieuse.

Le champ `packageManager` du `package.json` racine épingle la version de pnpm pour
tout le monde, y compris la CI.

## 6. Stratégie de test

Ce qui existe aujourd'hui est de bonne qualité et se transpose presque ligne à ligne.

- **Unitaire (Vitest)** — `domain` et `protocol` : barème, correction, réducteur,
  validation des messages. Tout ce qui est pur, donc l'essentiel des règles.
- **Fixtures HTML** — `article` : parité d'index, déduplication, normalisation des
  espaces, injection. Les fixtures viennent de vraies pages Wikipédia gelées, comme
  aujourd'hui.
- **Intégration (Testcontainers ou Neon branch + Redis local)** — API, base, cache,
  facturation des indices, isolation des sessions.
- **Protocole** — client WebSocket de test contre `apps/realtime` : autorisation
  d'hôte, refus d'homonyme, survie au JSON invalide, throttles, reconnexion,
  fin de manche par timeout, deux instances sur une même salle.
- **E2E (Playwright)** — deux navigateurs dans une même salle : le parcours complet,
  et les **assertions négatives** qui remplacent le smoke SSR actuel : aucun
  paragraphe saboté dans le DOM pendant la manche, aucune explication, attribution
  CC BY-SA présente avant et après.
- **Verrou documentaire** — la doc du protocole est générée depuis les schémas Zod ;
  le test échoue si le fichier commité diverge du généré.

Les assertions négatives sont l'héritage le plus important du projet actuel : elles
attrapent une fuite de solution qu'aucun test positif ne verrait.

---

## 7. Risques

| Risque | Effet | Traitement |
|---|---|---|
| Parité d'index texte ↔ DOM lors du portage cheerio | Le joueur est noté sur les mauvais paragraphes — le bug historique du projet | Lot 3 en premier, fixtures réelles, test de parité avant toute autre chose |
| `generateObject` change le comportement du modèle | Falsifications de qualité différente, plus ou moins subtiles | Prompt repris textuellement au départ ; comparaison sur un jeu de catégories fixe avant d'y toucher |
| Redis + Lua pour l'état de salle | Complexité supérieure au dict en mémoire | Le réducteur reste pur et testé hors Redis ; Redis n'applique que des transitions déjà décidées |
| Deux hébergeurs (Vercel + Fly) | Plus de surface d'exploitation, CORS et origines WebSocket à tenir | Origines et jetons explicites dès le lot 6, pas en fin de parcours |
| Volume du lot 9 | La manche concentre l'essentiel du front | Découpage interne par feature, chacune livrée avec sa galerie de composants |
| PR finale énorme et non bissectable | Revue difficile | Commits par lot, conventional-commits en français, message de PR structuré lot par lot |
| Régression silencieuse d'un invariant de §3 | Une garantie payée par un bug en production disparaît sans bruit | §3 est une liste de contrôle, cochée test par test, et c'est la porte du lot 12 |

---

## 8. Ce qu'on ne fait pas

- Pas de monétisation, pas d'organisations, pas de Stripe. Le périmètre retenu
  s'arrête aux comptes, à l'historique et aux statistiques.
- Pas de redesign : l'identité visuelle actuelle est transcrite, pas repensée.
- Pas de changement de modèle LLM dans le même mouvement que le changement de stack.
  Gemini reste par défaut ; l'AI Gateway rend la bascule ultérieure triviale.
- Pas d'i18n. L'UI mélange aujourd'hui français et anglais ; on **unifie en
  français** (`lang="fr"` est verrouillé par test), sans introduire de framework
  de traduction.
- Pas de portage du CLI mort, du prompt mort, des composants morts
  (`HintsPanel`, `Leaderboard` en variante sidebar), ni de `get_feedback`.
