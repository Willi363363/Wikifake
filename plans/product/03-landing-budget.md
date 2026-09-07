# Track C — the performance budget, and what a laptop can say about it

The record of step C.7. `03-landing.md` keeps the step table — the only place
that says where a step stands; `03-landing-scene.md` records how the scene was
built and `03-landing-degraded.md` what reaches somebody who never gets one.

## C.7 is two claims wearing one sentence

Non-negotiable 3 reads: "composite-only properties (`transform`, `opacity`); no
layout-triggering property animated per frame; the scene detached when
off-screen. The budget: **60fps on a mid-range Android**, and no regression to
the existing Lighthouse scores. Measured on a device, not on a laptop."

They are not measured the same way, and separating them is most of this step:

| Claim | Where the answer lives |
|---|---|
| composite-only, no layout per frame | the scene itself — the same answer on every machine |
| the scene detached when off-screen | the page's own geometry |
| 60fps on a mid-range Android | a phone, in somebody's hand |
| no Lighthouse regression | a baseline that was never recorded |

**The structural claim is the one that decides the number.** A scene that lays
out once per frame is slow on every device; one that only composites is fast on
almost all of them. So the first row is asserted, permanently, and the third is
reported with the method written down for whoever holds the phone.

## What is asserted, and how

`apps/e2e/specs/landing-performance.spec.ts` scrolls the whole track one step
per animation frame — from inside the page, so that one frame means one step and
the deltas are the scene's cadence rather than the harness's — and reads
Chromium's own counters either side.

**Layouts are measured as a slope, not as a count.** The traverse runs at 60
frames and at 480, and eight times the frames must not be eight times the
layouts. Measured, in that order:

```
frames    60    120    240    480
layouts   11     12     12     12
recalcs   60    121    240    476
```

Flat. The layout the scene does is per *handover*, not per frame: `inert` moves
on and off two beats at each of the three, six mutations however slowly the
track is crossed. Style recalculation is the one that scales — one per frame,
exactly, because writing a custom property is precisely that. It is the cheap
half, and asserting that it *does* scale is what stops the first assertion from
passing on a driver that quietly stopped writing anything.

A single number would have been a magic constant somebody later raised. The
slope cannot be raised without admitting what it means.

`movement.test.ts` carries the same claim at the level of a property name: it
follows `--beat-progress` through every custom property derived from it —
`--beat-in`, `--copy-opacity`, `--row-reveal`, `--mark-reveal` — and refuses any
real property spending one that is not `opacity` or `transform`. Verified by
adding `height: calc(var(--row-reveal) * 3rem)` to the scoreboard: the scan
names `height`, in milliseconds, without a browser.

## What is reported

A throttled desktop Chromium, scrolling the whole track. `Emulation.setCPU
ThrottlingRate` is the throttle, and its limit is worth stating: it slows the
**main thread**, which is where the driver runs, and not the compositor or the
GPU, which is where most of this scene's work happens. So this measures the
driver honestly and the paint not at all.

```
1×    median 16.7ms   p95 16.7ms   worst 16.8ms   0 dropped
4×    median 16.7ms   p95 16.7ms   worst 16.8ms   0 dropped
6×    median 16.7ms   p95 16.8ms   worst 16.8ms   0 dropped
10×   median 16.7ms   p95 16.7ms   worst 16.8ms   0 dropped
20×   median 33.3ms   p95 50.0ms   worst 50.1ms   109 dropped
```

Locked to vsync until 10× and halved at 20×. A mid-range Android is usually
put at 4× to 6× against a developer laptop on single-thread work, so the margin
is large — which is a reason to expect the device measurement to pass, and not
a substitute for it.

The load, on a 412×915 viewport at 4× CPU behind 1.6 Mbps and 150ms of latency:

```
ttfb 13ms   fcp 756ms   lcp 756ms   load 2056ms
cls 0.000   blocking 0ms   298kB over 20 requests
```

`cls` is the one asserted, and the reason is that it is a **ratio of the
viewport rather than a duration**: a slower machine returns the same number, so
it is the one Core Web Vital that does not measure the runner. A scroll scene is
the classic way to break it; this one does not, because the fonts carry their
metrics from `next/font` and the scene's movement is `transform`, which shifts
nothing. Total blocking time is asserted loosely for the same reason it is worth
asserting at all: it is 0ms, and a landing page that starts blocking has grown a
script it did not have.

## The Lighthouse clause cannot be met as written

"No category below its **current** score on the existing home route." No current
score was ever recorded — the search above finds the criterion in two places in
this repository and a number in none — and the pre-scene home route shipped in
#178, so the baseline it refers to no longer exists to measure.

What this step does instead is record the numbers above **as** the baseline, in
a form a machine reproduces: the spec prints them on every run. The clause is
worth keeping for what comes after; it was unmeasurable for what came before.

## The detach never engages, and the reason is the page

The budget says "the scene detached when off-screen", and `use-stage.ts`
implements it with an `IntersectionObserver` at the default threshold — which
means *entirely* outside the viewport. Measured at maximum scroll, 1280×720:

```
viewport 720   document 3153   scrollY 2433
track bottom at 511 inside the viewport, 209px of page below it
```

The track is four screens tall and what follows it is a licence notice. There is
no scroll position at which the stage is off-screen, so the observer never fires
and the safeguard is inert.

Not a defect, and deliberately not "fixed": it costs one observer, it is correct
as written, and it starts working the moment a section is added below the
landing — which track J will do. Worth knowing rather than worth changing, and
worth not citing as an optimisation that is currently doing anything.

## What is left of C.7, and how to do it

The device measurement. It needs a phone, which is why the step is marked ⚠️
rather than ✅.

1. Open the pull request's Vercel preview URL on a mid-range Android — the
   deployment comment on any PR carries it. Note the model and the Chrome
   version; they are half the measurement.
2. On a desktop, Chrome → `chrome://inspect/#devices`, with USB debugging on.
   Inspect the phone's tab.
3. DevTools → **Performance** → record, scroll the whole landing with a thumb at
   a normal reading speed, stop.
4. Read the **Frames** track, not the FPS average: what matters is dropped
   frames during the three handovers, which is where the scene does its only
   layout. Note the count and the worst frame.
5. Run **Lighthouse** in the same DevTools, mobile preset, on `/`. Record the
   four category scores here — they are the baseline the clause above wants.
6. Write the numbers into this file, tick C.7 in `03-landing.md`, and say which
   phone said them.

Below `md` the scene never engages, so on a phone held upright this is measuring
**the document**, not the stage. That is the right thing to measure — it is what
a phone gets — but it means the 60fps criterion, read literally, is about a
tablet or a phone held sideways. Both are worth one recording each.
