# WikiFake — working instructions

A misinformation-detection game: the server fetches a Wikipedia article, a
language model injects factual errors into it, and players have to find them —
alone or together, sabotaging each other with items.

## Language: English, everywhere

**Everything written in this repository is in English.** Code, identifiers,
comments, commit messages, pull request titles and descriptions, documentation,
tests, log messages, error messages, and — from the rewrite onwards — the user
interface.

The only deliberate exception: the game reads `fr.wikipedia.org`, so article
content and the topics players type stay French. That is data, not our prose.

French UI text is planned to come back through proper internationalisation, in
its own phase. Until then, everything new is English. See
`plans/rewrite/phase-11-i18n.md`.

## Read before writing a line

1. `plans/README.md` — the index, and **where the project stands**.
2. `plans/method/00-dev-cycle.md` — how we work: phases, steps.
3. `plans/method/01-git-flow.md` — branches, staging, main.
4. `plans/method/02-repository-rules.md` — what is forbidden.

Then the file for the current phase in `plans/rewrite/`. Nothing is improvised:
every piece of work maps to a **step** of an existing phase. If it does not,
document the step first.

## Non-negotiable

- **Never push to `main` or `staging`.** One branch, one pull request.
- **Everything is written in English**, including this conversation's output
  when it lands in the repository.
- **One step = one branch = one PR.** No out-of-scope work: a problem found
  along the way gets recorded, not fixed here.
- **Update the branch from `staging` before asking for a merge.** Conflicts are
  resolved on the branch, never in the PR.
- **Never disable a test, a lint rule or an assertion** to turn CI green.
- **No documentation outside `plans/`**, no file over 200 lines.
- **One source of truth** per business rule. Any front/back duplication is a
  bug waiting to happen.
- **Report faithfully**: a failing test, a skipped step, a check that was never
  run — say so.
- Sign agent-authored commits with a `Co-Authored-By:` trailer.

## Where to find what

| Question | File |
|---|---|
| How we work | `plans/method/` |
| What exists today | `plans/current-state/` |
| Where we are going, phase by phase | `plans/rewrite/` |
| What must never break | `plans/rewrite/01-contract-to-preserve.md` |

## Commands

```bash
nvm use        # Node 22, pinned by .nvmrc
pnpm install   # monorepo dependencies
make hooks     # install the git hooks — once per clone
make check     # what the pre-commit hook will run
pnpm test      # monorepo tests
make test      # legacy backend tests (Python, until phase 10)
```

Before asking for a merge: `bash scripts/checks.sh diff origin/staging`.
