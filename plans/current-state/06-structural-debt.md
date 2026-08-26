# Current state — structural debt

The other half of the debt register. `05-known-debt.md` holds the defects that
have a `file:line`; here are the problems that are about the shape of the
repository — a tool we cannot adopt yet, a convention that is ambiguous, a
check that does not cover what it looks like it covers. Same rule: recorded
here, fixed in the step it belongs to.

## The packages ship TypeScript, so the app cannot use Turbopack

Every package's `exports` points at `src/index.ts`, and their internal imports
carry a `.js` extension — the convention `verbatimModuleSyntax` asks for.
`tsc`, Vitest and `tsx` resolve `./x.js` to `./x.ts`; bundlers need telling.
webpack has `resolve.extensionAlias`, which Next exposes as
`experimental.extensionAlias`. **Turbopack has no equivalent**: it accepts the
flag as an experiment and ignores it, and `turbopack.resolveExtensions` applies
to extensionless requests, not to rewriting one extension into another.

So `apps/web` builds with `next build --webpack` (step 4.1). It works and Next
16 supports it, but webpack is the bundler on its way out: a deadline, not a
preference.

**The durable fix is a build step in each package** — emit `dist`, point
`exports` at it — which also removes `transpilePackages`. `turbo.json` is
already configured for it (`build` declares `outputs: ["dist/**"]`, and `test`
and `typecheck` depend on `^build`); no package has a `build` script, so phase 0
left it half-done. Not a five-minute change: every suite would start exercising
built output instead of source. Its own step, or phase 9.

## Two notations for the same contract

The phase sheets cite the contract as `§3.N` — the source plan's numbering,
where the contract was section 3, so `§3.1` is `C1` and `§3.4` is `C4`. The
contract files number the same guarantees `C1` to `C8`, with sub-clauses
`C4.1` and so on. Twenty citations across six sheets still use the old form.

Nothing is wrong: the mapping is consistent. It is ambiguous, because `§3.4`
and `C3.4` look like one reference and are two — `§3.4` is the cache, `C3.4` is
paragraph deduplication. `phase-03-steps-cache.md` cites `C4` outright for that
reason.

**Not a mechanical rename.** Some sites mean the section (`the cases of §3.2` →
`C2`), some mean one clause inside it (`the contract shape of §3.3 (1-based
indices, sorted positions, sequential numbers)` is `C3.3`). Each needs reading.
It also touches sheets that open pull requests have in flight, so it wants its
own step on a quiet tree.

## The remaining `print()` calls in `backend/src/core/`

The repository rule is "no `print` in application code" (`src/log.py`). Five
survive in `backend/src/core/`:

- `backend/src/core/settings.py:26` — warning when two `.env` files coexist.
- `backend/src/core/misinformation.py:119` — LLM hints inconsistent with the
  request, matched by position.
- `backend/src/core/misinformation.py:193` — missing paragraphs, retrying.
- `backend/src/core/flag_verifier.py:40` — Wikipedia search failure.
- `backend/src/core/flag_verifier.py:108` — LLM verification error.

## `apps/web` never typechecks its component tests

`apps/web/tsconfig.json` includes `app/**/*.ts`, `app/**/*.tsx` and
`src/**/*.ts` — but not `src/**/*.tsx`. The components under `src/` are checked
anyway, because `app/` imports them and the compiler follows imports. The
**tests** are not: nothing imports `src/**/*.test.tsx`, so `pnpm typecheck` has
never looked at any of them. Since phase 7 that is most of the frontend's tests.

They pass today — adding `src/**/*.tsx` to `include` reports nothing, checked
while writing step 7.6. So this is a check that covers less than it appears to,
not a set of broken files: the day a test's types are wrong, Vitest's esbuild
will strip them and the mistake will surface as a confusing runtime failure
instead of a type error.

**The fix is one line**, and it belongs with the CI work of phase 9 rather than
in a step that happens to notice it: `typecheck` is the job that has to be
trusted for it to mean anything.
