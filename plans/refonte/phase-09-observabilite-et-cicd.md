# Phase 9 — Observabilité et CI/CD

| | |
|---|---|
| **État** | à faire |
| **Branche** | `feat/refonte-phase-9` |
| **Dépend de** | phases 4, 5 et 8 |
| **Livre** | une CI/CD complète et un système qui se laisse observer |

## Objectif

Rendre le système observable — contrat `/api/health` conservé au champ près,
tableau de bord d'usage adossé à la table `llm_call`, journalisation
structurée, Sentry — et bâtir la chaîne CI/CD de la cible : GitHub Actions
(lint, typecheck, tests, build, e2e Playwright), web sur Vercel avec preview
par PR, temps réel sur Fly.io, sonde `deploy-check` portée, verrou
documentaire réimplémenté.

## Pourquoi maintenant

Les phases 4, 5 et 8 livrent l'API, les comptes et un front jouable de bout
en bout — tout ce que cette phase déploie, sonde et teste. Et la phase 10 est
impossible sans elle : on ne supprime pas le Python sans CI verte sur la
nouvelle stack ni sonde qui dise ce que la production sert. Deux garanties
actuelles meurent en silence si on ne les porte pas explicitement : la boucle
de vérification de déploiement (`deploy-check.yml`) et le verrou documentaire
(`test_architecture_doc.py`).

## Étapes

### 9.1 — Contrat `/api/health` conservé au champ près

`GET /ping` répond exactement `{"status": "alive"}`. `GET /api/health` expose
`status`, `version`, `commit` (chaîne présente même vide en local),
`commit_short` (7 caractères), `model`, `llm_configured` (booléen) — et
jamais la clé API. Le commit vient de `VERCEL_GIT_COMMIT_SHA` côté web et
d'une variable injectée au déploiement côté Fly, comme `RENDER_GIT_COMMIT`
aujourd'hui.

**Fini quand** : les cinq tests de `backend/tests/test_health.py` ont leur
équivalent Vitest, y compris « la clé n'apparaît jamais dans le JSON
sérialisé ».

### 9.2 — Tableau de bord d'usage sur `llm_call`

`/api/usage` lit la table `llm_call` au lieu de compteurs en mémoire : tokens
entrée/sortie par type d'appel, échecs comptés à part, `cache_hit_rate` et
`per_generated_game` (coût par partie réellement générée, non dilué par le
cache) toujours exposés.

**Fini quand** : les tests de `test_usage.py` ont leur équivalent, et un
redémarrage du service ne remet plus les compteurs à zéro — c'était toute la
raison d'être de la table.

### 9.3 — Journalisation structurée et Sentry

Logs JSON (niveau, horodatage, identifiant de requête ou de salle) sur `web`
et `realtime` ; `scripts/checks.sh` interdit déjà `console.log`. Sentry sur
les deux services, DSN par variable d'environnement, release étiquetée au
commit.

**Fini quand** : une erreur déclenchée volontairement sur une preview
apparaît dans Sentry avec le bon commit, pour chacun des deux services.

### 9.4 — Réécrire `ci.yml` pour le monorepo

Jobs `lint`, `typecheck`, `test`, `build` via pnpm et le cache Turborepo.
Deux choses se conservent : le job `guard` — son dédoublonnage push/PR est ce
qui garantit qu'une PR de phase vers la parapluie garde ses vérifications —
et le job pytest, tant que `backend/` existe. Il ne part qu'à la phase 10.

**Fini quand** : la CI passe avec les nouveaux jobs et l'ancien job Python,
et un push sans PR ouverte déclenche toujours un run.

### 9.5 — e2e Playwright en CI

Le parcours du §6 du plan : deux navigateurs dans une même salle, et les
assertions négatives — aucun paragraphe saboté ni explication dans le DOM
pendant la manche, attribution CC BY-SA visible pendant et après. Sans appel
LLM réel : article servi depuis une fixture, clé factice comme aujourd'hui.

**Fini quand** : le job e2e passe en CI, et échoue si l'on fait fuiter
volontairement un champ de la solution dans le payload de départ.

### 9.6 — Verrou documentaire, version Zod

La documentation du protocole (messages WS entrants et sortants, routes REST,
codes d'erreur) est générée depuis les schémas de `packages/protocol` par un
script pnpm ; un test compare le fichier généré au fichier commité. C'est la
réimplémentation de `test_architecture_doc.py` : sans elle, la garantie « la
doc ne dérive pas du code » disparaît sans bruit. Le test Python, lui,
tourne désormais sur `plans/etat-des-lieux/*.md` et doit continuer de
passer jusqu'à la phase 10.

**Fini quand** : ajouter un message au schéma sans régénérer la doc fait
échouer `pnpm test`.

### 9.7 — Déployer le web sur Vercel

Projet Vercel branché sur le dépôt, preview par PR, variables d'environnement
posées. La production publique reste servie par Render jusqu'à la phase 10 :
Vercel ne reçoit pas encore le domaine.

**Fini quand** : chaque PR obtient une URL de preview dont `/api/health`
renvoie le commit de la PR.

### 9.8 — Déployer le temps réel sur Fly.io

`fly.toml` dans `apps/realtime`, déploiement depuis la CI, health check
exposant le commit servi, URL Redis et origines WebSocket autorisées par
variables d'environnement.

**Fini quand** : une partie multijoueur se joue depuis une preview Vercel
contre l'instance Fly déployée.

### 9.9 — Porter la sonde `deploy-check`

Après un push sur `main`, le workflow interroge la sonde de santé et compare
`commit` au SHA poussé jusqu'à expiration du délai. Deux services désormais :
le web et le temps réel, chacun son URL. Comportement conservé : skip propre
si la variable d'URL n'est pas définie, `workflow_dispatch` avec délai
réglable. `DEPLOY_URL` continue de pointer sur Render jusqu'à la bascule.

**Fini quand** : lancé à la main contre une preview, le workflow réussit sur
le bon SHA et échoue sur un SHA différent.

### 9.10 — Mettre à jour les checks requis du ruleset

Les rulesets de `main` et `staging` exigent la CI verte par nom de job. Les
noms changent : sans mise à jour du ruleset, chaque PR se bloque sur un check
« en attente » qui ne viendra jamais.

**Fini quand** : une PR de test vers `staging` passe au vert sans check
fantôme, et les nouveaux noms figurent dans la liste des checks requis.

## Porte de sortie

- CI verte : lint, typecheck, tests, build, e2e — plus le job Python, encore
  en vie jusqu'à la phase 10.
- Preview Vercel par PR ; service Fly déployé et joignable.
- Sonde `deploy-check` fonctionnelle contre les deux services.
- Verrou documentaire actif : doc générée = doc commitée, vérifié en CI.
- Le coût d'une partie est lisible en base et survit à un redémarrage.

## Invariants concernés

Les sections « Identité du déploiement » et « Le verrou documentation ↔
code » de `01-contrat-a-preserver.md`, en entier. Plus, dans « Cache et
comptabilité », l'exposition de `cache_hit_rate` et `per_generated_game`.

## Pièges

- **Le job `guard` n'est pas décoratif.** Le supprimer « pour simplifier »
  laisse les PR de phase vers la parapluie sans aucune vérification — un
  correctif `fix(ci)` a déjà été payé pour l'apprendre.
- **Le ruleset se met à jour en même temps que les noms de jobs**, pas
  après : entre les deux, toutes les PR du dépôt sont bloquées.
- Les jobs de l'ancienne stack partent avec le code qu'ils testent, pas
  avant : supprimer le job pytest ici ferait passer la phase 10 sans filet.
- La protection des previews Vercel peut répondre 401 à la sonde et aux
  e2e : prévoir un jeton de contournement ou sonder sans protection.
- Pas de vrai LLM en CI : lent, coûteux, non déterministe. La clé factice
  actuelle est un principe à garder, pas un pis-aller.
- DSN Sentry et jetons Fly/Vercel vont dans les secrets GitHub, jamais dans
  le dépôt — `checks.sh` en attrape certains, pas tous.
