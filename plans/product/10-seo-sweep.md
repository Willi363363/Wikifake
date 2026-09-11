# Track J — the phone sweep, over the screens that grew out of it

The record of **J.10**. `10-seo-and-legal.md` keeps the step table — the only
place that says where a step stands.

## The sweep had not weakened; the application grew out of it

Phase 6 measured `/`, `/play`, `/solo` and `/gallery` at 360 px, and track D
added the round reached by playing. J.1 found that tracks E to I had since added
eight routes and J.3 and J.5 three documents, **and that none of the eleven was
measured**.

That is the failure worth naming, because it repeats: a list of routes written
into a test is a list that stops being complete the moment somebody adds a page,
and nothing fails when it does. The same shape as the indexing decision J.9 had
to centralise, and as the export J.11 still has to catch up.

## What is swept now

Ten routes as a stranger — `/`, `/play`, `/solo`, `/gallery`, `/leaderboard`,
`/sign-in`, `/sign-up`, `/faq`, `/privacy`, `/terms` — and three behind an
account: `/profile`, `/quests`, `/shop`. **Every one of them already fitted.**
The sweep found no defect, which is the honest result and not a wasted step: the
point of it is the eleventh page, the one somebody adds next.

## Reachability is half the assertion, and the half that could have been faked

`/profile`, `/quests` and `/shop` send a stranger to `/sign-in` or `/sign-up`.
A sweep that visited them as a stranger would have measured **the sign-in form,
three times, and passed** — a screen unmeasured while appearing in a list of
measured screens.

So each case asserts the path it ended on before it measures anything, and the
three behind an account are swept by an account: one sign-up, three screens,
each with its own heading checked. That is the "readable" half of what J.1 asked
for, as opposed to "the page answered".

## What it cost, and one thing it paid for

The measurement moved to `phone.ts` and phase 6's sweep reads it: two copies of
"what overflow is" is how two sweeps end up disagreeing about the measurement
rather than about the pages. Proved by narrowing the viewport to 180 px —
`/gallery` failed and named the five widest elements, so the extraction still
detects.

It also paid the price of a defect the register already carries: `signUp` in
`accounts.ts` **promises a wait it does not perform**
(`06-structural-debt.md`), so the first navigation after it raced the session
cookie and landed on `/sign-in`. Every caller pays that, and this one now says
so in a line above the wait rather than discovering it again.

## `/admin` is not swept, deliberately

It answers 404 to everybody who is not an administrator, and nothing in the
suite can make one: the role is a row in `admin`, written by hand. Sweeping it
would mean a database fixture for a screen whose only reader is the owner of the
deployment, on a panel that is read-only by design. **Recorded rather than
quietly skipped**, so the next audit finds a decision instead of a gap.
