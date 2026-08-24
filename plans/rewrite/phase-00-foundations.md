# Phase 0 — Foundations

| | |
|---|---|
| **State** | in progress — promotion to `main` open (#31) |
| **Branch** | `feat/refonte-phase-0` (created before the English-only rule; later phases use `feat/rewrite-phase-N`) |
| **Depends on** | nothing |
| **Delivers** | a monorepo that builds and tests with no code in it |

## Objective

Lay down the skeleton of the TypeScript monorepo and its tooling: package
manager, task orchestrator, strict TypeScript, linters, formatter, test
runner. Not a single line of business logic.

## Why now

Everything else rests on it. Writing domain code before having a strict
`tsconfig` and a test runner means writing code that will be judged twice.
And this is the phase that makes the linters available: `scripts/checks.sh`
detects and enables them on its own as soon as they exist.

## Steps

### ✅ 0.1 — Decide the Node version

**Decided: Node 22 LTS.** `.nvmrc` at 22, `engines: >=22.13.0`, pnpm 11.22.0
pinned by `packageManager`.

The development machine runs Node 20.18.3. pnpm 11 requires Node ≥ 22.13
(it loads `node:sqlite`), hence pnpm 10 today. The reasonable target is
**Node 22 LTS**, fixed by a `.nvmrc` and the `engines` field.

The Corepack shipped with Node 20.18.3 is broken — expired signing keys,
`Cannot find matching keyid` — so `npm i -g corepack@latest` is required
before any `corepack prepare`. To be written into the `README`, or everyone
will lose half an hour on it.

**Done when**: `.nvmrc` and `engines` are committed, `node -v` matches, and
the Corepack workaround is documented.

### ✅ 0.2 — Monorepo skeleton

`pnpm-workspace.yaml`, root `package.json` with `packageManager` pinned, the
`apps/` and `packages/` tree empty but declared. Turborepo with its `build`,
`test`, `lint`, `typecheck` tasks and their dependencies.

**Done when**: `pnpm install` then `pnpm build` and `pnpm test` succeed on a
repository with no code, and the Turborepo cache fills on the second call.

### ✅ 0.3 — Shared strict TypeScript

`packages/config` carries the base `tsconfig`: `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `verbatimModuleSyntax`. Packages extend it.

**Done when**: `pnpm typecheck` passes, and loosening an option makes a
configuration test fail.

### ✅ 0.4 — Linters and formatter

ESLint in flat configuration, TypeScript and React rules, plus Prettier.
A single configuration, shared from `packages/config`.

**Done when**: `pnpm lint` passes, and `bash scripts/checks.sh staged` on a
faulty TypeScript file fails — the signal that automatic linter detection
works.

### ✅ 0.5 — Test runner

Vitest at the root, one project per package, coverage enabled but with no
blocking threshold for now.

**Done when**: `pnpm test` discovers and runs a trivial test in two distinct
packages.

### ✅ 0.6 — Typed environment variables

A single Zod schema validates the environment at startup and fails loudly if
a variable is missing. `.env.example` lists everything, with dummy values.

**Done when**: starting without `DATABASE_URL` produces an explicit error
that names the variable, not an `undefined` three layers down.

### ✅ 0.7 — Update the repository tooling

`make hooks` and `make check` keep working; the root `README` describes the
setup in three commands.

**Done when**: a fresh clone is operational by following the `README`, with
no implicit knowledge.

### ✅ 0.8 — Let the promotion pass its own checks

The `staging` → `main` promotion pull request was refused by the conformance
job: `scripts/checks.sh branch` read its head, saw `staging`, and reported a
protected branch and a non-conforming name. The rule was right for every other
pull request and wrong for the only one that carries a batch to production.

`branch` now takes the base as a second argument and recognises the pair
`staging` → `main` documented in `../method/01-git-flow.md`. Nothing else is
loosened: any other protected head is still refused, and `push` is untouched.
The command grew its first tests, in `packages/config/src/branch-rules.test.ts`.

**Done when**: a test proves the promotion is accepted and that `main` as a
head, `staging` onto itself and a push to a protected branch are still refused;
the conformance job on the promotion PR is green.

## Exit gate

- `pnpm install && pnpm build && pnpm test && pnpm lint && pnpm typecheck`
  pass on a repository with no business logic.
- CI runs those five commands.
- `scripts/checks.sh` enables ESLint automatically.
- No dependency added without a justification in the PR.

## Contract touched

No functional invariant: the Python still runs, nothing is replaced. This is
the only phase for which that holds.

## Pitfalls

- **Do not install the world.** Every dependency of this phase will be there
  for the life of the project. Three lines beat a package.
- **Do not touch the existing code.** This phase adds, it does not migrate.
  The Vite `frontend/` keeps living alongside until phase 8.
- The current front's `package.json` and the root one will coexist: check
  that `pnpm install` at the root does not clobber
  `frontend/package-lock.json`, still used by CI and the `Dockerfile`.
- Turborepo caches aggressively: a badly declared task produces false
  greens. Check that a `pnpm test` after a change really re-runs.
