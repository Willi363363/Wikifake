# Phase 4 — API et authentification

| | |
|---|---|
| **État** | à faire |
| **Branche** | `feat/refonte-phase-4` |
| **Dépend de** | phase 3 |
| **Livre** | l'API REST du jeu solo et Better Auth, invités compris |

## Objectif

Exposer les route handlers Next.js dans `apps/web` — `/ping`, `/api/health`,
`/api/usage`, `/api/game/{start,hint,scan,submit}`,
`/api/multiplayer/create`, `/api/flag-report` — et poser Better Auth avec
des sessions invité rattachables à un compte créé après coup. À la sortie,
une partie solo se joue de bout en bout par l'API, avec ou sans compte.

## Pourquoi maintenant

Les briques existent : contrats (phase 1), base (phase 2), article
(phase 3). L'API les assemble sans rien redécider. Elle précède le temps
réel et l'UI, qui consommeront les mêmes contrats. L'auth arrive dans la
même phase parce que chaque route de jeu doit connaître son participant —
compte **ou** invité — dès son écriture, pas être rouverte après coup. Et on
doit pouvoir jouer sans compte : c'est ce qui fait vivre le jeu.

## Étapes

### 4.1 — `/ping` et `/api/health` au champ près

`GET /ping` répond **exactement** `{"status": "alive"}`. `GET /api/health`
expose `status`, `version`, `commit` (chaîne présente même vide en local),
`commit_short` (7 caractères), `model`, `llm_configured` (booléen). La clé
API n'apparaît jamais. La sonde CI compare `commit` au SHA poussé : ce
contrat doit survivre au champ près, sinon la boucle de vérification de
déploiement meurt en silence.

**Fini quand** : un test compare la réponse champ par champ, y compris le
cas `commit` vide en local, et un test par valeurs vérifie que la clé API
n'apparaît pas dans le JSON sérialisé.

### 4.2 — Better Auth

Better Auth dans le Postgres du projet : tables `user`, `session`,
`account`, `verification` (schéma de la phase 2), OAuth, routes
`/api/auth/*` montées dans `apps/web`.

**Fini quand** : créer un compte, ouvrir puis fermer une session
fonctionnent en test d'intégration contre la base.

### 4.3 — Sessions invité rattachables

Jouer sans compte : `participant` référence un compte **ou** un invité. Une
partie jouée en invité s'attache à un compte créé après coup — c'est la
porte de sortie du lot 5 du plan source.

**Fini quand** : en test d'intégration, une partie jouée en invité apparaît
dans l'historique du compte créé ensuite.

### 4.4 — `POST /api/game/start`

L'article vient de `packages/article` ; la partie est écrite en base
(`game`, `game_position`, `participant`). Le payload contient l'article et
le **nombre** de paragraphes falsifiés. Jamais lesquels, jamais les
explications, jamais les indices, jamais `original_text`.

**Fini quand** : un test vérifie **par clés et par valeurs** qu'aucun texte
de vérité ni d'indice n'apparaît dans le JSON sérialisé de la réponse.

### 4.5 — `POST /api/game/hint` et `POST /api/game/scan`

Indices facturés à l'appel, niveaux monotones et facturés une seule fois :
niveau 2 débloqué puis niveau 1 redemandé renvoie le niveau 2 ; répéter le
niveau 2 ne refacture pas. Le texte d'un indice n'est jamais transmis avant
paiement ; chaque achat écrit une ligne `hint_purchase`. Le SCANNER est
résolu serveur : un vrai faux non encore désigné, mémorisé par joueur,
`null` quand il n'en reste plus.

**Fini quand** : les cas de monotonie et de non-refacturation de §3.1
passent via l'API, et `scan` renvoie `null` après épuisement.

### 4.6 — `POST /api/game/submit`

Le score est calculé par le serveur depuis son propre état, avec le barème
de `packages/domain`. Les pénalités déclarées par le client sont ignorées :
`hintsUsed: 9`, `hintPenalty: 9999`, `scoreStolen: -100000` produisent un
breakdown à zéro. La solution complète arrive avec la réponse, pas avant.

**Fini quand** : le cas de référence du barème (`tp=3, fp=1, pénalité=20,
volé=50, 200 s restants sur 300 → 400`) passe via l'API, et les pénalités
déclarées par le client n'ont aucun effet sur le breakdown.

### 4.7 — `GET /api/usage`

Depuis `llm_call` en base : `cache_hit_rate` et `per_generated_game`
restent exposés. Aujourd'hui les compteurs repartent de zéro à chaque
redémarrage ; en base, ils survivent.

**Fini quand** : après des générations en test d'intégration, les deux
mesures sont exactes et identiques après redémarrage du handler.

### 4.8 — `POST /api/multiplayer/create`

Codes de salle uniques sur 6 caractères, création plafonnée (503 au-delà),
salle écrite en base (`room`). Le service temps réel qui l'animera arrive à
la phase suivante.

**Fini quand** : deux créations donnent des codes distincts de 6 caractères,
et le plafond atteint renvoie 503 en test.

### 4.9 — `POST /api/flag-report`

Remplace `complaints.jsonl` : signalement et verdict du modèle en table
`flag_report`. Le vérificateur interroge Wikipédia avec la langue explicite
de la phase 3, jamais un état global.

**Fini quand** : un signalement en test écrit une ligne `flag_report`
complète, et rien n'est écrit sur disque.

## Porte de sortie

- Tous les invariants de §3.1 (autorité serveur) sur le solo, testés via
  l'API.
- Contrat `/api/health` conservé au champ près ; `/ping` répond exactement
  `{"status": "alive"}`.
- Une partie invité s'attache à un compte créé après coup.
- Une partie solo se joue de bout en bout par l'API, sans UI.

## Invariants concernés

Voir `01-contrat-a-preserver.md` : **autorité serveur** (§3.1 — la solution
ne quitte pas le serveur, score serveur, indices monotones, SCANNER
serveur), **le barème** (§3.2 — cas de référence via `submit`), **cache et
comptabilité** (§3.4 — `cache_hit_rate` et `per_generated_game` sur
`/api/usage`) et **identité du déploiement** (§3.7 — `/ping` et
`/api/health`).

## Pièges

- **La sonde de déploiement meurt en silence** si `/api/health` change d'un
  champ : `commit` présent même vide, `commit_short` exactement 7
  caractères, `llm_configured` booléen — pas « à peu près pareil ».
- Tester la fuite de solution **par valeurs**, pas seulement par clés :
  renommer une clé suffit à tromper un test de clés.
- L'invité n'est pas un mode dégradé : chaque route de jeu accepte un
  participant invité dès son écriture, pas par un contournement ajouté à la
  fin.
- Aucun état en mémoire : la session solo vit en base. Un redémarrage ou une
  seconde instance ne doit rien perdre — c'est ce que l'ancien backend ne
  savait pas faire.
- Le barème ne se recopie pas dans les handlers : il vit dans
  `packages/domain`, l'API l'appelle. C'est la duplication de vérité que la
  refonte est censée fermer.
