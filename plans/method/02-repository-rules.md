# Repository rules

The git flow lives in `01-git-flow.md`, the work breakdown in
`00-dev-cycle.md`. This file covers the rest: what we write, what we do not
write, and what is checked automatically.

These rules apply identically to humans and to agents. An agent produces more
code, faster, with less context: it needs more guard rails, not fewer.

## English, everywhere

**Everything written in this repository is in English.** Code and identifiers,
comments, commit messages, pull request titles and descriptions, documentation,
test names, log messages, error messages, and — from the rewrite onwards — every
string the player sees.

One deliberate exception, and it is data rather than prose: the game reads
`fr.wikipedia.org`, so article content and the topics players type stay French.

Two known leftovers, both already scheduled:

- The interface still mixes French and English. It becomes English-only in
  phase 8, and French returns as a real locale in phase 11 — see
  `../rewrite/phase-11-i18n.md`. Untranslated leftovers are not
  internationalisation.
- The GitHub check contexts are still named in French. Renaming them means
  updating the ruleset's required checks in the same move, or every pull
  request blocks forever on a check that never reports. Phase 9 handles it.

Do not translate what would break on translation: branch names, environment
variable names, existing check contexts, and anything quoted from the current
Python code.

## Commits

Conventional commits, subject in English, imperative mood:

```
type(scope): short description

The body explains the problem and why this fix. Not what the diff does — the
diff already says that.
```

- Types: `build` `chore` `ci` `docs` `feat` `fix` `perf` `refactor` `revert`
  `style` `test`.
- Subject 72 characters or fewer, no trailing period.
- A commit that does two things gets split into two commits.
- An agent-authored commit carries a `Co-Authored-By:` trailer. One must be
  able to tell where a line came from.

## Pull requests

A pull request is mergeable when:

1. CI is green — every job, not only the one you were watching;
2. the branch is up to date with its target;
3. the description says **why**: problem, cause, fix, what a test covers;
4. it does one thing. A fix plus a rename plus a dependency is three PRs.

## What an agent never does

- **Push to `main` or `staging`.** An agent that cannot push stops and says so;
  it does not look for a way around.
- **Use `--no-verify`, or `--force` on a shared branch.**
- **Disable a test, a lint rule or an assertion to turn CI green.** A red test
  is information, not an obstacle. If it is genuinely obsolete, say so in the
  PR and justify it.
- **Use a bare `git stash`**: the stash is shared across worktrees and another
  session can pop it. Prefer a temporary work commit.
- **Create a file outside the expected locations**, a document outside
  `plans/`, or a dependency, unless that is the subject of the PR.
- **Widen the scope.** A real problem found along the way goes into
  `../current-state/05-known-debt.md`; it does not get fixed here.
- **Report optimistically.** A failing test, a skipped step, a check that was
  never run: say it. A flattering report costs more than an announced failure.

## Repository structure

- No new top-level directory unless that is the subject of the PR.
- A source file over 500 lines gets split. Aim for 300.
- **One source of truth per business rule.** The scoring table, the item
  catalogue and the message contracts live in one place and are imported. Any
  front/back duplication is a bug waiting to happen.
- No dead code. A component, a prompt or a function nothing calls gets deleted
  — git remembers it.
- No `window.*` or global to make two modules talk to each other.

## Documentation

- **All documentation lives in `plans/`.** At the root, only `README.md` and
  `CLAUDE.md`, plus the standard files (`CHANGELOG`, `SECURITY`,
  `CONTRIBUTING`, `HANDOVER`).
- **No documentation file over 200 lines.** Past that, split it. Documentation
  nobody rereads is documentation that is wrong.
- Documentation is updated **in the PR that changes the behaviour**, not after.
- No parallel tracking file: `plans/README.md` carries progress, phase files
  carry steps. Nothing else.
- The current-state documentation is locked by a test: documented routes and
  messages must match the code. Adding a route without touching the docs breaks
  CI, deliberately.

## Tests

- Every bug fix ships with the test that was failing before it.
- Every business rule — scoring, authorisation, validation — is tested without
  network, without a database and without a model.
- The **negative assertions** are sacred: they verify that the game's solution
  never leaks to the client. None is removed without an equivalent replacement.
- A slow test is not a reason to delete it, but to move it.

## Secrets and dependencies

- No secret in git. Ever. A `.env` is not versioned; only `.env.example` is,
  with dummy values.
- A key that touched a commit is compromised: revoke it, do not quietly remove
  it.
- The dependency lockfile is versioned, versions are pinned.
- A new dependency is justified in the PR: what it brings, its weight, who
  maintains it. Three lines of code beat a package.

## Logging

No `print()` and no `console.log` in application code: use a logger, with a
level. `console.warn` and `console.error` are allowed on the client.

## How these rules are enforced

Local hooks give feedback in one second, but can be bypassed (`--no-verify`):
they are guard rails, not locks. The lock is CI; the real lock is the GitHub
ruleset.

| Rule | Local hook | CI | GitHub |
|---|---|---|---|
| No commit or push to `main` / `staging` | `pre-commit`, `pre-push` | `push-direct` job | ruleset |
| Branch name | warning | blocking | — |
| Commit format | `commit-msg` | blocking | — |
| Hardcoded secret, versioned `.env` | `pre-commit` | blocking + gitleaks | — |
| Hygiene, file size | `pre-commit` | blocking | — |
| `print` / `console.log` | `pre-commit` | blocking | — |
| Documentation: 200 lines, inside `plans/` | `pre-commit` | blocking | — |
| Linters | if installed | blocking | — |
| Human review | — | `Revue humaine` job | ruleset |
| PR required, CI green | — | — | ruleset |

Both sides run the **same** file, `scripts/checks.sh`: there is no local
version and no CI version drifting apart.

```bash
git config core.hooksPath .githooks        # once per clone, or make hooks
bash scripts/checks.sh staged              # what the hook will run
bash scripts/checks.sh diff origin/staging # what CI will run
```
