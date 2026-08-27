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
built output instead of source. Phase 9 came and went without it, so it wants
its own step after the cutover, on a tree nothing else is moving.

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

## The `Makefile` targets that outlived the Makefile

Step 10.9 rewrote `make check` and `make hooks` as `pnpm check` and
`pnpm hooks`, and deleted the rest with the stack they drove. Two of the
replacements are shell one-liners in `package.json`:

```json
"check": "bash scripts/checks.sh staged",
"hooks": "git config core.hooksPath .githooks && echo \"…\""
```

They work, and `scripts/checks.sh` is still the single file both the hook and
CI run — there is no local version and no CI version drifting apart. But a
shell string in a `scripts` block is not portable in the way the rest of the
toolchain is, and `hooks` in particular does two things in one line. Small, and
worth folding into `scripts/` proper the next time somebody is in there.
