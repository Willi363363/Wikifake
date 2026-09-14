# Current state — structural debt

One of three debt registers, and the one about **the shape of the repository**:
a tool we cannot adopt yet, a convention that is ambiguous, a check that does
not cover what it looks like it covers.

| Register | What goes in it |
|---|---|
| `05-known-debt.md` | defects and gaps with a `file:line` |
| this file | the shape of the repository and its code |
| `08-toolchain-debt.md` | the commands you run, and what they do not tell you |
| `10-test-debt.md` | the suites: why a green run can be wrong |

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

## Protocol and socket sentences reach players untranslated — closed at 11.9

`chat.tsx` fell back to `decode` issue sentences from `@wikifake/protocol`, and
the room screen showed the `message` authored in `apps/realtime` beside each
error code. They were English under any interface locale.

**Closed on 2026-09-11 by step 11.9**, along the line this entry argued for: the
packages emit codes, the client owns the sentences. `errors.refusals` in the
catalogue answers for all twenty-three `ERROR_CODE`s in both languages, a parity
test holds the two lists to each other, and an unknown code falls back to a
sentence rather than to an identifier. Kept here rather than deleted, because
the argument is the reusable part: the next package that wants to say something
to a player has the same choice to make.

Structural rather than a defect with a location, and that is why it sits here
rather than in the register next door: the fix is not to catalogue a string in
`apps/web`, it is to decide that a package which authors a player-visible
sentence must emit a **code** the client translates. That decision belongs to
`@wikifake/protocol` and `apps/realtime`, not to step 11.2's zones, and it would
change what those packages are allowed to put on the wire.

Recorded during phase 11 because the zone work ran into it and could not fix it
from where it stood.

## ~~`border-l-3` emits nothing~~ — the finding was wrong, 2026-09-11

**`border-l-3` emits a rule, and always did at this version.** The 2026-09-06
entry said it emitted nothing while the other three sides resolved, filed it as
a probable Tailwind bug, and left a `border-l-[length:var(--border-width-3)]`
workaround in two files with comments telling nobody to simplify it back. This
replaces it, because a register that keeps a wrong entry is worse than one that
never had it.

What a clean `next build` of this repository actually produces, Tailwind 4.3.3 —
the version the lockfile pinned then and pins now:

```
.border-l-3,.border-l-\[length\:var\(--border-width-3\)\]{
  border-left-style: var(--tw-border-style);
  border-left-width: var(--border-width-3)
}
```

**The rule was there and the search was not.** Lightning CSS merges rules whose
declarations are identical, so the two spellings share one selector list — and
the workaround was on the same element as the class it was working around.
Searching the built stylesheet for `.border-l-3{`, with the brace, finds
nothing: the built rule has a comma there. The other three sides had no
workaround beside them, so their rules stood alone and matched.

Confirmed twice over. Tailwind's own compiler, handed `border-l-3` against this
repository's `globals.css`, emits the same declarations as the other three
sides; and a `next build` with `.next` deleted and no arbitrary-value class left
anywhere in the tree emits `.border-l-3` on its own.

**Both files are simplified back**, and the token keeps the number.

**The general lesson, corrected.** The old one — read the built stylesheet
rather than trusting a class name — still holds. What it was missing is that
*reading* a built stylesheet is its own skill: it has been minified, and a
minifier merges, reorders and rewrites. Match the whole selector list, not a
name and a brace. The first grep of this investigation made the same mistake the
original finding did, which is how the mistake got understood.

## ~~`disabled:opacity-40`~~ — closed on 2026-09-11

`buttonVariants` faded a disabled button to 40%, and on the primary button that
composited `#ffe14d` against the page and the black text with it: `Submitted` in
the round's top bar read as grey on cream, recognisably off and only just
legible. **Nothing could measure it** — `CONTRAST_PAIRS` measures two declared
tokens, an opacity composite is neither of them, and WCAG 1.4.3 exempts a
disabled control, so no audit called it either. It was invisible to every check
this repository has, which is why it survived a whole track that looked at it.

The fix is the one this entry predicted: the direction's own vocabulary, a flat
fill and a collapsed shadow, text a step down. `muted` on `bg-grain` is now a
row of the audit at 6.52 and 7.05, so the state that could not be measured is
measured on every run.

**It was five places, not one.** The entry said `buttonVariants`, because that
is where it was found; the input, the label, the host's toggle and the item tile
each spelled their own. That is the part worth keeping: a rule written once in a
primitive is obeyed by whoever imports it and re-typed by everyone else.
`primitives/disabled.test.ts` scans both trees for the next one.

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

## `signUp` promised a wait it did not perform — closed 2026-09-11

`apps/e2e/specs/accounts.ts` documented itself as "creates the account, **and
waits for the screen it lands on**", with a paragraph explaining that waiting
there rather than in each caller is what stops a spec from racing the pseudonym
claim E.3.2 added. The body filled three fields, clicked, and returned.

Nothing failed, because every caller had grown its own wait — and `profile.spec`
had grown a private copy of the whole function, which is the duplication
`accounts.ts` was created to end. **A contract nobody keeps is paid for one line
at a time by whoever reads it next**, and it cost J.10 a red run.

**Closed**, and the line is not the obvious one: it waits for the form to be
*left*, not for `/play` to be reached. An account whose pseudonym is already
claimed lands on `/choose-a-name`, which `pseudonym.spec.ts` exists to prove, so
a helper insisting on `/play` would have hung on the spec that tests the other
half. The callers keep their `toHaveURL`: it stopped being a wait and became the
assertion it always read like.
