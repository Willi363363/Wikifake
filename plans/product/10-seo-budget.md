# Track J — a budget over every entry screen

The record of **J.8**. `10-seo-and-legal.md` keeps the step table — the only
place that says where a step stands.

## What existed, and what the audit found wrong with it

C.7 gave the landing a budget and CI has failed on it since: layouts that do not
scale with frames, the worst throttled frame under 250 ms, CLS under 0.1,
blocking under 200 ms. J.1 found the rest of the site had **no number at all** —
and that a budget over one page is a budget over the page somebody happened to
be thinking about.

So J.8 is not "invent a budget", which is what the track file assumed before the
audit: it is **extend one**, over the six screens a visitor can arrive on.

## Measured before it was written

The palette of track A was measured before any CSS moved, and this is the same
discipline applied to bytes. On a production build, throttled to 4× CPU and a
mid-band mobile connection, at 412 px:

```
/             300kB over 20 requests
/play         307kB over 33
/faq          266kB over 17
/privacy      266kB over 17
/terms        266kB over 17
/leaderboard  282kB over 34
```

**The ceiling is 400kB**, a third again as much as the heaviest. A ceiling at
the measurement fails the day somebody adds a paragraph; one at twice it does
not notice a charting library arriving. A third is the band where the first
unnecessary dependency shows up and ordinary work does not.

It counts everything the page fetched — document, JavaScript, fonts — rather
than scripts alone, because the most expensive thing anybody is likely to add to
a page of prose is a picture.

## Three numbers asserted, four reported, and the split is the point

**CLS and weight do not depend on the machine.** A ratio of the viewport and a
count of bytes are the same on a laptop and on a loaded CI runner, so they can
fail a build without anybody learning to retry it.

**Blocking time does depend on it**, and is asserted anyway at 200 ms — loose
enough that only a regression reaches it, not a busy afternoon.

**TTFB, FCP, LCP and load are printed and never asserted.** They are the
baseline the exit gate's "no category below its current score" needs, and a
build that failed on them would fail because somebody else's job was compiling.
That is how a budget ends up deleted.

## What it cost, and why the sharing was worth it

`vitals.ts` now owns the measurement — the phone viewport, the throttling, the
observer and the reading — and C.7's spec reads it too. Two copies of "how we
measure" is how two budgets end up disagreeing about the measurement rather than
about the pages.

The extraction was checked against itself: C.7's spec reports the same
`300kB / cls 0.000 / blocking 0ms` after the move as before it.

**Checked by lowering the ceiling to 200kB**: `/faq` failed and said which route
and which number. A budget nobody has seen fail is a budget nobody knows is
wired up.

## What is still not measured

- **The round.** It needs a generated article, and its cadence is C.7's subject
  anyway. Its own budget would be a different measurement — frames during play
  rather than bytes on arrival.
- **A real device.** C.7's exit gate asks for 60 fps on a mid-range Android and
  `03-landing-budget.md` carries the runbook. Nothing here replaces it: 4× CPU
  is a stand-in, and it is named as one.
