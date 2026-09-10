# Current state — structural debt

One of three debt registers, and the one about **the shape of the repository**:
a tool we cannot adopt yet, a convention that is ambiguous, a check that does
not cover what it looks like it covers.

| Register | What goes in it |
|---|---|
| `05-known-debt.md` | defects and gaps with a `file:line` |
| this file | the shape of the repository and its code |
| `08-toolchain-debt.md` | the commands you run, and what they do not tell you |

It split on 2026-09-06, at 190 lines with two findings waiting for room. The
axis is the one that was already there: half these entries were about code
somebody would read, half about a command somebody would run, and the second
half is where every new finding was landing.

Same rule as the other two: recorded here, fixed in the step it belongs to.

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

## `border-l-3` emits nothing, and the other three sides do

Measured on 2026-09-06, in one build, from one file Tailwind scans, with all
four classes present in the source:

```
border-3     → border-width: var(--border-width-3)          ✅
border-r-3   → border-right-width: var(--border-width-3)    ✅
border-t-3   → border-top-width: var(--border-width-3)      ✅
border-b-3   → border-bottom-width: var(--border-width-3)   ✅
border-l-3   → (no rule at all)                             ❌
```

**Why this is worth a register entry rather than a shrug.** The failure is
silent in every direction it can be. Nothing errors, nothing warns, the class
stays in the markup, the build succeeds, review passes — and the border is
simply not drawn. The one place it was used, the scanner line of the paragraph
token, would have been an animation nobody could see moving, which is the
hardest kind of absence to notice: there is no gap where it should be, because
a line that was never there leaves no gap.

It was found by reading the built stylesheet, not by looking at the page.

**What we do about it.** The workaround is
`border-l-[length:var(--border-width-3)]`, which works and keeps the number in
the token. It is in `packages/ui/src/token/paragraph-token.tsx`, with a comment
saying why, so nobody simplifies it back.

**What we have not done.** Understood it. `--border-width-3` is a theme token
rather than one of Tailwind's own scale values, and the left side behaving
differently from the other three points at the framework rather than at us —
but that is a hypothesis, not a diagnosis. Reproducing it in a bare Tailwind
project is what would turn this into an upstream bug report, and nobody has.

**The general lesson, which outlives this particular class.** A utility class
that generates nothing is indistinguishable from one that generates correctly,
in the source, in a diff and in a review. Where a class carries something
structural — a border that is the design, a colour that is a contrast pair —
read the built stylesheet once rather than trusting the name.

## `disabled:opacity-40` is a translucency the direction otherwise forbids

`buttonVariants` fades a disabled button to 40%. On the primary button that
composites `#ffe14d` against the page and black text with it, so `Submitted` in
the round's top bar and a not-yet-valid `Flag it` read as grey on cream —
recognisably disabled, and only just legible.

Nothing measures it: `CONTRAST_PAIRS` measures declared token pairs, and an
opacity composite is neither of the two colours in one. WCAG 1.4.3 exempts a
disabled control, so no audit calls it either.

The answer is a disabled *style* rather than an opacity — the direction has one
already, in that a flat fill and a collapsed shadow say "not now" without
diluting anything. It belongs to `packages/ui`, which owns the variant and the
gallery that pins it, so track D looked at it and left it.

## `margin-top: 0` on a stacked beat loses on specificity

`app/landing-stage.css` sets it inside the scene's media query, with the comment
"an absolutely positioned box with a margin is a box 5rem off the mark" — right
about the consequence, wrong about the fix. The document rhythm above it is
`.landing-stage__beat + .landing-stage__beat`, two classes against one, and a
media query adds no specificity. Measured in Chromium at 1280 wide: beat 1 at
`margin-top: 0px` and `top: 64`, beats 2 to 4 at `80px` and `top: 192`.

The three that agree are why C.4's collision assertion never saw it — it
compares beats 2 and 3. Beat 1 is the one that differs: its content is centred
in a box 80px taller, so the landing's question sits about 40 pixels above where
every heading after it sits. Cosmetic, and real. Same family as the two entries
above: a rule that reads correctly, reviews correctly and does nothing.

## `signUp` promises a wait it does not perform, and a copy of it still does

`apps/e2e/specs/accounts.ts:58` documents itself as "creates the account, **and
waits for the screen it lands on**", with a paragraph explaining that waiting
there rather than in each caller "is what stops a spec from asserting against a
page that is still mid-claim". The body fills three fields, clicks, and returns.

Two things say the gap is already being paid for. `account-data.spec.ts:91`
carries a comment compensating for it — *"waited for, not assumed: `signUp`
clicks and returns"* — and `profile.spec.ts:18` keeps a **local** `signUp` that
is the shared one plus the missing `toHaveURL`, while importing `someone` from
the shared file beside it. That local copy is exactly the duplication
`accounts.ts` was created to end.

Nothing is failing: all four callers of the shared helper follow it with their
own wait. What is wrong is the contract, and the next spec to trust the sentence
will race the pseudonym claim E.3.2 added — intermittently, which is the failure
mode the helper was written against.

The fix is one line in the helper and the deletion of the local copy. It is left
here because those two together change what five specs wait on, which is not an
aside in a step about a debrief.

## The all-time leaderboard reads the whole mode, because it needs a name

Measured in G.4 at fifty thousand entries: the daily, weekly and regional
boards answer in 2–3 ms with their range pushed into an index; the all-time
board takes **45 ms**, reading every entry in the mode.

**The scan is the cause — not the index, and since G.7 not the sort either.** A
board is one row per player now, so `distinct on` reduces twenty-five thousand
entries to two thousand before the ordering; but every entry is still read to
find each player's best, and deduplicating costs more than sorting did (45 ms
against 18 ms). Its cost grows with the game's history where every other
board's grows with its period. Fine here; seconds at a hundred times it. The
ways out and the numbers are in `../product/07-leaderboards-queries.md`.
