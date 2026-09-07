// Step C.7 — the half of the performance budget a laptop can actually answer.
//
// Non-negotiable 3 of `plans/product/03-landing.md` is two claims wearing one
// sentence, and they are not measured the same way:
//
// - **a structural one** — "composite-only properties; no layout-triggering
//   property animated per frame". That is true or false about the scene itself,
//   it is the same answer on every machine, and a browser can be asked it
//   directly. It is asserted here.
// - **a number** — "60fps on a mid-range Android, measured on a device, not on a
//   laptop". No CI runner can answer that, and a throttled desktop Chromium is
//   an indicator rather than the criterion. It is *reported* here, and the step
//   stays open until somebody holds a phone.
//
// The distinction matters because the structural claim is the one that decides
// the number. A scene that lays out once per frame is slow on every device; a
// scene that only composites is fast on almost all of them. So the assertion
// below is the one that would still be worth running if the device measurement
// were done tomorrow — it is what stops the budget being *undone* later.
import { expect, test, type Page } from '@playwright/test';

/**
 * How much slower than this machine to pretend to be.
 *
 * Four, which is the usual figure for a mid-range Android against a developer
 * laptop on single-thread work. It is a stand-in and it is named as one: the
 * exit gate asks for a device, and `03-landing-budget.md` carries the runbook
 * for measuring one.
 */
const CPU_SLOWDOWN = 4;

/**
 * The two lengths the structural claim is asked at.
 *
 * Eight times apart, because the claim is about *scaling* rather than about a
 * count: a scene that lays out per frame costs eight times as much over the
 * long traverse, and one that lays out per handover costs the same. A single
 * number could only ever have been a magic constant somebody later raised.
 */
const SHORT = 60;
const LONG = 480;

/** How many frames the cadence report spends crossing the track. */
const FRAMES = 120;

interface Cadence {
  readonly frames: number;
  readonly median: number;
  readonly p95: number;
  readonly worst: number;
  readonly dropped: number;
  readonly travelled: number;
}

/**
 * Scrolls the whole track, one step per animation frame, and times the frames.
 *
 * Driven from inside the page rather than by `page.mouse.wheel`, and the
 * difference is not laziness: a wheel event is delivered on the browser's own
 * schedule, so the scroll and the frames it produces are two independent
 * cadences and what comes back is a measurement of the harness. Scrolling by a
 * fixed step *in* the frame callback makes one frame mean one step, which is
 * what turns the deltas below into something a reader can compare.
 *
 * `scrollBy` is a real scroll: the same listener, the same compositor path, the
 * same custom properties written. What it is not is a user gesture, and nothing
 * here depends on it being one.
 */
async function traverse(page: Page, steps: number): Promise<Cadence> {
  return page.evaluate(
    (count: number) =>
      new Promise<Cadence>((resolve) => {
        const track = document.querySelector<HTMLElement>('.landing-stage__track');
        if (track === null) {
          resolve({
            frames: 0,
            median: Number.NaN,
            p95: Number.NaN,
            worst: Number.NaN,
            dropped: 0,
            travelled: 0,
          });
          return;
        }

        const top = track.getBoundingClientRect().top + window.scrollY;
        const travel = track.offsetHeight - window.innerHeight;
        const step = travel / count;
        window.scrollTo(0, top);

        const deltas: number[] = [];
        const from = window.scrollY;
        let previous = performance.now();
        let done = 0;

        const tick = (now: number): void => {
          // The first delta is the gap since the scroll above, not a frame the
          // scene produced, so it is recorded and dropped below.
          deltas.push(now - previous);
          previous = now;
          window.scrollBy(0, step);
          done += 1;

          if (done < count) {
            requestAnimationFrame(tick);
            return;
          }

          const timed = deltas.slice(1).sort((a, b) => a - b);
          const at = (ratio: number): number =>
            timed[Math.min(timed.length - 1, Math.floor(timed.length * ratio))] ??
            Number.NaN;

          resolve({
            frames: timed.length,
            median: at(0.5),
            p95: at(0.95),
            worst: timed[timed.length - 1] ?? Number.NaN,
            // A dropped frame, not a slow one: at 60Hz the interval is 16.7ms
            // and the next vsync is 33.3, so anything past 20 has missed one.
            // Counting "over 16.7" instead counts floating-point noise around
            // vsync — it read 45 frames of 119 on a scene that never dropped
            // one. Reported rather than asserted: on a shared CI runner this
            // counts the runner as often as it counts the scene.
            dropped: timed.filter((delta) => delta > 20).length,
            travelled: Math.round(window.scrollY - from),
          });
        };

        requestAnimationFrame(tick);
      }),
    steps,
  );
}

/** One of Chromium's own performance counters, by name. */
async function counter(
  client: { send: (method: 'Performance.getMetrics') => Promise<unknown> },
  name: string,
): Promise<number> {
  const read = (await client.send('Performance.getMetrics')) as {
    metrics: { name: string; value: number }[];
  };
  return read.metrics.find((metric) => metric.name === name)?.value ?? Number.NaN;
}

test.describe('C.7 — the budget, as a structure', () => {
  test('lays out per handover, not per frame', async ({ page }) => {
    await page.goto('/');
    // The scene at rest, and the page settled: what is being counted is the
    // traverse, not the load.
    await expect(page.getByRole('heading', { name: 'Who is lying?' })).toBeVisible();

    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    /** One traverse's cost, in Chromium's own counters. */
    const cost = async (steps: number) => {
      const layoutBefore = await counter(client, 'LayoutCount');
      const styleBefore = await counter(client, 'RecalcStyleCount');
      const cadence = await traverse(page, steps);
      return {
        frames: cadence.frames,
        travelled: cadence.travelled,
        layouts: (await counter(client, 'LayoutCount')) - layoutBefore,
        styles: (await counter(client, 'RecalcStyleCount')) - styleBefore,
      };
    };

    const short = await cost(SHORT);
    const long = await cost(LONG);

    // Both traverses actually happened, and the long one really is eight times
    // the frames: a scene that never scrolled would lay out nothing either, and
    // would pass everything below without meaning a thing.
    expect(short.frames).toBeGreaterThan(SHORT / 2);
    expect(long.frames).toBeGreaterThan(short.frames * 4);
    expect(long.travelled).toBeGreaterThan(1000);

    /*
     * **Non-negotiable 3's first half, measured — and measured as a slope
     * rather than as a count.**
     *
     * The driver reads `scrollY` and writes custom properties; the stylesheet
     * spends them on `transform` and `opacity`, and neither is a layout. What
     * layout the scene does costs per *handover*: `inert` moves on and off two
     * beats at each of the three, which is six mutations across the whole
     * track however slowly it is crossed.
     *
     * So eight times the frames must not be eight times the layouts. Measured
     * in Chromium at 60, 120, 240 and 480 frames: 11, 12, 12, 12. The slack
     * below is for the handful Chromium does for reasons of its own — a
     * scrollbar, a sticky element first engaging — and it is nowhere near the
     * 480 a per-frame layout would produce.
     */
    expect(long.layouts).toBeLessThan(short.layouts + 8);

    /*
     * And the guard on the other side: style recalculation *does* scale, one
     * per frame, because writing a custom property is exactly that.
     *
     * It is the cheap half — no geometry, no paint — and it is what the
     * technique costs. Asserting it is what stops the test above from passing
     * on a driver that quietly stopped writing anything at all.
     */
    expect(long.styles).toBeGreaterThan(long.frames * 0.8);
  });

  test('reports what a throttled CPU makes of it', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Who is lying?' })).toBeVisible();

    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });

    const cadence = await traverse(page, FRAMES);

    // Printed, because a number nobody reads is a number nobody acts on, and
    // this one is evidence for a step rather than a gate on a merge.
    // eslint-disable-next-line no-console
    console.log(
      `C.7 — ${String(CPU_SLOWDOWN)}× CPU: ${String(cadence.frames)} frames, ` +
        `median ${cadence.median.toFixed(1)}ms, p95 ${cadence.p95.toFixed(1)}ms, ` +
        `worst ${cadence.worst.toFixed(1)}ms, ${String(cadence.dropped)} dropped`,
    );

    expect(cadence.frames).toBeGreaterThan(FRAMES / 2);

    /*
     * **The one thing asserted, and it is deliberately not 16.7ms.**
     *
     * A frame threshold on a shared CI runner measures the runner: the same
     * scene passes at 8ms on an idle machine and fails at 20ms next to a
     * `pnpm build`, and a journey that has to be retried to pass is one nobody
     * believes afterwards. What no amount of load explains is a quarter-second
     * frame — that is a layout or a paint per frame, not a busy neighbour, and
     * it is the failure this whole budget exists to prevent.
     *
     * The 60fps criterion is not this. It is on a device, and it is C.7's
     * remaining half.
     */
    expect(cadence.worst).toBeLessThan(250);
  });
});

test.describe('C.7 — the load, on a phone-shaped browser', () => {
  // A mid-range phone's viewport and pixel ratio. Not a device, and not
  // pretending to be: what it buys is the layout a phone gets — below `md`, so
  // the scene never engages — measured with a slow CPU and a slow network under
  // it, which is the state the exit gate's Lighthouse clause is about.
  test.use({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  test('arrives without shifting anything under it', async ({ page }) => {
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
    await client.send('Network.enable');
    // Roughly a mid-band mobile connection: 1.6 Mbps down, 150ms of latency.
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });

    await page.addInitScript(() => {
      // Buffered, and installed before the document: the largest contentful
      // paint happens long before any test code could ask for it.
      const store = window as unknown as { largestPaint?: number };
      store.largestPaint = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) store.largestPaint = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    });

    await page.goto('/', { waitUntil: 'load' });
    await expect(page.getByRole('heading', { name: 'Who is lying?' })).toBeVisible();
    // Long enough for the fonts to swap and for anything late to shift.
    await page.waitForTimeout(2000);

    const vitals = await page.evaluate(() => {
      const navigation = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;
      const paints = performance.getEntriesByType('paint');
      // `layout-shift` and `resource` carry fields this project's `lib` does not
      // declare, so both are read through `unknown` rather than asserted onto a
      // type the DOM library says they are not.
      const shifts = performance.getEntriesByType('layout-shift') as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[];
      const resources = performance.getEntriesByType('resource') as unknown as {
        transferSize?: number;
      }[];
      const store = window as unknown as { largestPaint?: number };

      return {
        ttfb: Math.round(navigation.responseStart),
        fcp: Math.round(
          paints.find((paint) => paint.name === 'first-contentful-paint')?.startTime ??
            Number.NaN,
        ),
        lcp: Math.round(store.largestPaint ?? Number.NaN),
        load: Math.round(navigation.loadEventEnd),
        // Only the shifts nobody asked for: one that follows an interaction is
        // the page answering, not the page moving under a reader.
        cls: shifts
          .filter((shift) => !shift.hadRecentInput)
          .reduce((total, shift) => total + shift.value, 0),
        blocking: performance
          .getEntriesByType('longtask')
          .reduce((total, task) => total + Math.max(0, task.duration - 50), 0),
        kilobytes: Math.round(
          resources.reduce((total, resource) => total + (resource.transferSize ?? 0), 0) /
            1024,
        ),
        requests: resources.length,
      };
    });

    // eslint-disable-next-line no-console
    console.log(
      `C.7 — 412px, ${String(CPU_SLOWDOWN)}× CPU, 1.6Mbps: ttfb ${String(vitals.ttfb)}ms, ` +
        `fcp ${String(vitals.fcp)}ms, lcp ${String(vitals.lcp)}ms, load ${String(vitals.load)}ms, ` +
        `cls ${vitals.cls.toFixed(3)}, blocking ${String(Math.round(vitals.blocking))}ms, ` +
        `${String(vitals.kilobytes)}kB over ${String(vitals.requests)} requests`,
    );

    /*
     * **The one Core Web Vital a scroll scene is likely to break, and the one
     * that does not depend on how fast the machine running this is.**
     *
     * Cumulative layout shift is a ratio of the viewport, not a duration: a
     * slower runner produces the same number. 0.1 is the "good" threshold; this
     * page measures 0.000, because nothing on it is positioned from anything
     * that arrives late — the fonts carry their metrics from `next/font`, and
     * the scene's own movement is `transform`, which shifts nothing.
     *
     * The timings above are reported and not asserted, for the reason the
     * cadence test gives. They are the baseline this step records: the exit
     * gate asks for "no category below its current score", and no current score
     * had ever been written down.
     */
    expect(vitals.cls).toBeLessThan(0.1);

    // And nothing blocks the main thread long enough to be felt: a long task is
    // 50ms, and what is counted is the excess over that.
    expect(vitals.blocking).toBeLessThan(200);
  });
});
