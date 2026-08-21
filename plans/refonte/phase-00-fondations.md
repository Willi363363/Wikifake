# Phase 0 — Fondations

| | |
|---|---|
| **État** | à faire |
| **Branche** | `feat/refonte-phase-0` |
| **Dépend de** | rien |
| **Livre** | un monorepo qui compile et teste à vide |

## Objectif

Poser le squelette du monorepo TypeScript et son outillage : gestionnaire de
paquets, orchestrateur de tâches, TypeScript strict, linters, formateur,
lanceur de tests. Aucune ligne de logique métier.

## Pourquoi maintenant

Tout le reste s'y appuie. Écrire du domaine avant d'avoir `tsconfig` strict et
un lanceur de tests, c'est écrire du code qu'on rejugera deux fois. Et c'est la
phase qui rend les linters disponibles : `scripts/checks.sh` les détecte et
les active tout seul dès qu'ils existent.

## Étapes

### 0.1 — Trancher la version de Node

Le poste de développement est en Node 20.18.3. pnpm 11 exige Node ≥ 22.13
(il charge `node:sqlite`), d'où pnpm 10 aujourd'hui. La cible raisonnable est
**Node 22 LTS**, fixée par un `.nvmrc` et le champ `engines`.

Le Corepack livré avec Node 20.18.3 est cassé — clés de signature périmées,
`Cannot find matching keyid` — il faut `npm i -g corepack@latest` avant tout
`corepack prepare`. À écrire dans le `README`, sinon chacun y perdra une
demi-heure.

**Fini quand** : `.nvmrc` et `engines` sont commités, `node -v` correspond, et
le contournement Corepack est documenté.

### 0.2 — Squelette du monorepo

`pnpm-workspace.yaml`, `package.json` racine avec `packageManager` épinglé,
arborescence `apps/` et `packages/` vide mais déclarée. Turborepo avec ses
tâches `build`, `test`, `lint`, `typecheck` et leurs dépendances.

**Fini quand** : `pnpm install` puis `pnpm build` et `pnpm test` réussissent sur
un dépôt sans code, et le cache Turborepo se remplit au second appel.

### 0.3 — TypeScript strict partagé

`packages/config` porte le `tsconfig` de base : `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `verbatimModuleSyntax`. Les paquets l'étendent.

**Fini quand** : `pnpm typecheck` passe, et relâcher une option fait échouer un
test de configuration.

### 0.4 — Linters et formateur

ESLint en configuration plate, règles TypeScript et React, plus Prettier.
Une seule configuration, partagée depuis `packages/config`.

**Fini quand** : `pnpm lint` passe, et `bash scripts/checks.sh staged` sur un
fichier TypeScript fautif échoue — c'est le signal que la détection
automatique des linters fonctionne.

### 0.5 — Lanceur de tests

Vitest à la racine, projets par paquet, couverture activée mais sans seuil
bloquant pour l'instant.

**Fini quand** : `pnpm test` découvre et exécute un test trivial dans deux
paquets distincts.

### 0.6 — Variables d'environnement typées

Un schéma Zod unique valide l'environnement au démarrage et échoue fort si une
variable manque. `.env.example` recense tout, avec des valeurs factices.

**Fini quand** : démarrer sans `DATABASE_URL` produit une erreur explicite qui
nomme la variable, pas un `undefined` trois couches plus loin.

### 0.7 — Mettre à jour l'outillage du dépôt

`make hooks` et `make check` continuent de fonctionner ; le `README` racine
décrit l'installation en trois commandes.

**Fini quand** : un clone neuf est opérationnel en suivant le `README`, sans
connaissance implicite.

## Porte de sortie

- `pnpm install && pnpm build && pnpm test && pnpm lint && pnpm typecheck`
  passent sur un dépôt sans logique métier.
- La CI exécute ces cinq commandes.
- `scripts/checks.sh` active ESLint automatiquement.
- Aucune dépendance ajoutée sans justification en PR.

## Invariants concernés

Aucun invariant fonctionnel : le Python tourne toujours, rien n'est remplacé.
C'est la seule phase dans ce cas.

## Pièges

- **Ne pas installer le monde.** Chaque dépendance de cette phase sera là pour
  la durée du projet. Trois lignes valent mieux qu'un paquet.
- **Ne pas toucher au code existant.** Cette phase ajoute, elle ne migre pas.
  Le `frontend/` en Vite continue de vivre à côté jusqu'à la phase 8.
- Le `package.json` du front actuel et celui de la racine vont coexister :
  vérifier que `pnpm install` à la racine n'écrase pas
  `frontend/package-lock.json`, encore utilisé par la CI et le `Dockerfile`.
- Turborepo met en cache agressivement : une tâche mal déclarée produit des
  faux verts. Vérifier qu'un `pnpm test` après modification relance bien.
