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

## Two accessibility criteria are inferred from CSS, never seen

Phase 6's exit gate asks that `prefers-reduced-motion` neutralise the shakes and
the stroboscopic flashes, and that the gallery hold at 360 px. Both are checked
by reading a stylesheet: `packages/ui/src/motion.test.ts` asserts that the seven
reducible animations — the strobes and the displacements — are set to `none` by
name inside `motion.css`'s media block, and `packages/ui/src/responsive.test.ts`
refuses a length larger than `--width-floor` with no breakpoint in front of it.

That is real evidence and it catches real regressions. It is not the criterion.
A media block can be correct and still not apply; a layout can declare no oversized
length and still overflow at 360 px, because overflow comes from content as
often as from a declaration.

The obstacle the phase named — "there is no browser in CI" — **is gone**. Step
9.5 brought Playwright, and `Browser journeys` runs on every pull request. What
is missing is two journeys: one with `reducedMotion: 'reduce'` on the context,
one with a 360 px viewport, both asserting on what the page actually does.
Playwright supports each in one line of configuration.

Recorded rather than done because it is new test surface, not an unfinished step
of phase 6 — and because a journey asserting on animation is the kind that
flakes if it is written in a hurry. The phase closed on the evidence it has;
this is what would make the evidence match the claim.

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

## A pull request title becomes a commit subject, and nothing checks it

Found by causing it, during the batch of 2026-08-28.

GitHub builds a squash commit's subject from the pull request **title** plus
` (#NNN)`, and `scripts/checks.sh commit-msg` refuses a subject over 72
characters. #125's title was 82, so the commit that landed on `staging` was 89.
The conformance job walks `git rev-list BASE..HEAD`, so the next
`staging` → `main` promotion failed on a commit that had already been merged.

**There is no clean way out once it has happened.** The commit is immutable
without a force-push to a protected branch; a later revert does not remove it
from the range; and weakening the check to go green is the one thing the rules
forbid outright. It costs either an amended force-push or an administrator's
bypass — both of which are exactly what the branch protection exists to prevent.

Structural rather than a defect, because the gap is in *where* the rule is
enforced. Every local hook and every CI job passes at the moment the mistake is
made. The title is the one input to a commit message that nothing validates, and
the bill arrives at a later promotion, in a pull request that did nothing wrong.

**The rule to carry meanwhile:** a title must be at most 72 minus the width of
` (#NNN)` — 65 characters in practice — whenever the merge will be a squash.

**The fix, unwritten:** the conformance job already has the pull request in its
event payload. Measuring `github.event.pull_request.title` on `opened`,
`edited` and `reopened` would refuse it before a commit exists, which is the only
moment it is still cheap.

## Protocol and socket sentences reach players untranslated

`chat.tsx` falls back to `decode` issue sentences from `@wikifake/protocol`, and
the realtime provider shows close reasons authored in `apps/realtime`
(`name_taken`, `room_not_found`, `invalid_name`). They are English under any
interface locale.

Structural rather than a defect with a location, and that is why it sits here
rather than in the register next door: the fix is not to catalogue a string in
`apps/web`, it is to decide that a package which authors a player-visible
sentence must emit a **code** the client translates. That decision belongs to
`@wikifake/protocol` and `apps/realtime`, not to step 11.2's zones, and it would
change what those packages are allowed to put on the wire.

Recorded during phase 11 because the zone work ran into it and could not fix it
from where it stood.
