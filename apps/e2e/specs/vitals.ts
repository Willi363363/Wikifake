// How a page load is measured, in one place — step J.8.
//
// C.7 wrote this against the landing, because the landing was the only page
// with a budget. J.8 gives the other entry screens one, and a second copy of
// "how we measure" is how two budgets end up disagreeing about what they
// measured rather than about the pages.
//
// Everything here is the throttled, phone-shaped load: a mid-range phone's
// viewport, a slowed CPU and a mid-band mobile connection. Not a device, and
// not pretending to be — what it buys is the layout and the cadence a phone
// gets, which is the state worth failing a build over.
import type { Page } from '@playwright/test';

/** A mid-range phone's viewport and pixel ratio, as `test.use` takes it. */
export const PHONE = {
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
} as const;

/**
 * How much slower than this machine to pretend to be.
 *
 * Four, which is the usual figure for a mid-range Android against a developer
 * laptop on single-thread work. It is a stand-in and it is named as one: C.7's
 * exit gate asks for a device, and `plans/product/03-landing-budget.md` carries
 * the runbook for measuring one.
 *
 * It was C.7's constant and is now shared, because J.8's budgets have to be
 * measured under the same CPU as the landing's or the numbers are not
 * comparable to each other.
 */
export const CPU_SLOWDOWN = 4;

/** What one load measured. Durations in milliseconds, weight in kilobytes. */
export interface Vitals {
  readonly ttfb: number;
  readonly fcp: number;
  readonly lcp: number;
  readonly load: number;
  /** Cumulative layout shift — a ratio of the viewport, not a duration. */
  readonly cls: number;
  /** Total blocking time: the excess of every long task over 50ms. */
  readonly blocking: number;
  readonly kilobytes: number;
  readonly requests: number;
}

/** A slow CPU and a mid-band mobile connection, applied to this page. */
export async function throttle(page: Page): Promise<void> {
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
}

/**
 * Starts recording the largest contentful paint.
 *
 * Installed before the document and buffered: the largest paint happens long
 * before any test code could ask for it.
 */
export async function observeLargestPaint(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const store = window as unknown as { largestPaint?: number };
    store.largestPaint = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) store.largestPaint = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
}

/**
 * What the page has measured about itself, read after it has settled.
 *
 * `layout-shift` and `resource` carry fields this project's `lib` does not
 * declare, so both are read through `unknown` rather than asserted onto a type
 * the DOM library says they are not.
 */
export async function readVitals(page: Page): Promise<Vitals> {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType(
      'navigation',
    )[0] as PerformanceNavigationTiming;
    const paints = performance.getEntriesByType('paint');
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
}

/** One line per page, in the shape C.7 reported and J.8 kept. */
export function reportVitals(label: string, vitals: Vitals): string {
  return (
    `${label} — 412px, ${String(CPU_SLOWDOWN)}× CPU, 1.6Mbps: ttfb ${String(vitals.ttfb)}ms, ` +
    `fcp ${String(vitals.fcp)}ms, lcp ${String(vitals.lcp)}ms, load ${String(vitals.load)}ms, ` +
    `cls ${vitals.cls.toFixed(3)}, blocking ${String(Math.round(vitals.blocking))}ms, ` +
    `${String(vitals.kilobytes)}kB over ${String(vitals.requests)} requests`
  );
}
