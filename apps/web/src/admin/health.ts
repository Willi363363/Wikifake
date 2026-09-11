// Are both services up, on which commit, and how slow — step I.2.
//
// **From the existing probes**, which is what the track asked for: `/api/health`
// is already the contract `deploy-check.yml` polls after every push, and both
// services answer the same shape at the same path. Nothing new is instrumented
// here, and that is the whole reason this section is cheap.
//
// Three rules, and each of them is about what a health page is *for*:
//
// **A failure is a value, not an exception.** A probe that throws takes the page
// with it, so the one screen that exists to say what is broken goes blank
// exactly when something is. Every probe below returns a reading, and an
// unreachable service is a reading that says so.
//
// **Every probe has a deadline.** A service that has stopped answering does not
// refuse — it hangs, which is the failure a page without a timeout inherits.
//
// **They run together.** The page's own latency is then the slowest probe rather
// than the sum of all of them, which matters because the exit gate asks for the
// panel in under a second and one asleep free-tier service would eat that alone.
import { pingDatabase, type Database } from '@wikifake/db';
import { healthApi, decode } from '@wikifake/protocol';

import { deploymentIdentity } from '../deployment.js';

/** How long any one probe may take before it counts as down. */
export const PROBE_TIMEOUT_MS = 2_000;

export interface HealthContext {
  readonly db: Database['db'];
  /** Injected so a test can answer, hang, or fail without a network. */
  readonly fetch?: typeof globalThis.fetch;
  /** Milliseconds, monotonic. A parameter like every clock in this repository. */
  readonly now?: () => number;
  /** Where the socket service is. Absent means it is not configured. */
  readonly realtimeUrl?: string | undefined;
}

/**
 * One thing probed.
 *
 * `up` is a boolean and `detail` is a sentence's worth of why — not an enum,
 * because the reasons are a network's and not a closed set. `ms` is present even
 * for a failure: how long it took to fail is the difference between *refused*
 * and *timed out*, and that is the first thing anybody wants to know.
 */
export interface Reading {
  readonly name: 'web' | 'realtime' | 'database';
  readonly up: boolean;
  readonly ms: number;
  readonly detail: string;
  /** The commit the service says it is running, when it said one. */
  readonly commit?: string;
}

export interface HealthView {
  readonly readings: readonly Reading[];
  /**
   * Whether the two services agree about what is deployed.
   *
   * The figure this section is really for. `deploy-check.yml` asserts it in CI
   * once per push; here it answers the question that outlives the push — the web
   * app deploys in seconds and the socket service does not, so *the halves are
   * running different code* is a live state, not a build failure.
   *
   * `null` when it cannot be known: either service down, or no commit to compare
   * because nothing is deployed from git. Null rather than false, because
   * *unknown* and *disagreeing* are not the same news.
   */
  readonly sameCommit: boolean | null;
  /** What this process itself is, which needs no probe. */
  readonly identity: healthApi.HealthResponse;
}

/** Times one probe and turns any failure into a reading. */
async function probe(
  name: Reading['name'],
  now: () => number,
  work: () => Promise<{ detail: string; commit?: string }>,
): Promise<Reading> {
  const started = now();
  try {
    const { detail, commit } = await work();
    return {
      name,
      up: true,
      ms: now() - started,
      detail,
      ...(commit === undefined ? {} : { commit }),
    };
  } catch (error) {
    // The message and not the stack: this is rendered on a page, and a stack
    // trace on an admin screen is a stack trace in a screenshot.
    return {
      name,
      up: false,
      ms: now() - started,
      detail: error instanceof Error ? error.message : 'unreachable',
    };
  }
}

/**
 * `select 1`, and nothing else.
 *
 * The query is `@wikifake/db`'s, because this application may not import
 * `drizzle-orm` — phase 2's exit gate, and a health probe is no exception to it.
 * What is decided here is only that a failure becomes a reading.
 */
async function probeDatabase(context: HealthContext, now: () => number) {
  return probe('database', now, async () => {
    await pingDatabase(context.db);
    return { detail: 'answering' };
  });
}

/**
 * The socket service's own `/api/health`.
 *
 * Read through the protocol's schema rather than as loose JSON, so a service
 * answering something else is *down* rather than a page rendering `undefined`.
 * That is the same decision `deploy-check.yml` made about this contract.
 */
async function probeRealtime(context: HealthContext, now: () => number) {
  return probe('realtime', now, async () => {
    const base = context.realtimeUrl ?? '';
    if (base === '') throw new Error('no realtime URL configured');

    const call = context.fetch ?? globalThis.fetch;
    // `http` from `ws`: the same deployment, and the health path is not a socket.
    const url = new URL('/api/health', base.replace(/^ws/, 'http'));
    const answer = await call(url, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!answer.ok) throw new Error(`answered ${String(answer.status)}`);

    const said = decode(healthApi.healthResponse, await answer.json());
    if (!said.ok) throw new Error('answered something we cannot read');

    return { detail: said.value.version, commit: said.value.commit };
  });
}

/**
 * The health section, ready to render.
 *
 * The web app's own reading needs no request: this code *is* the web app, so
 * asking itself over HTTP would measure the round trip and prove nothing that
 * rendering this page has not already proved.
 */
export async function readHealth(context: HealthContext): Promise<HealthView> {
  const now = context.now ?? (() => Date.now());
  const identity = deploymentIdentity();

  const web: Reading = {
    name: 'web',
    up: true,
    ms: 0,
    detail: identity.version,
    commit: identity.commit,
  };

  const [database, realtime] = await Promise.all([
    probeDatabase(context, now),
    probeRealtime(context, now),
  ]);

  // **No `!realtime.up` clause here, and a mutation is why.** It read
  // `!realtime.up || theirs === '' || …`, and removing the first half changed
  // no answer: `commit` is only ever set by a *successful* probe, so a service
  // that is down has no commit and the second clause already covers it. A
  // condition that cannot change an outcome is a condition a reader has to
  // verify for nothing.
  const theirs = realtime.commit ?? '';
  const sameCommit =
    theirs === '' || identity.commit === '' ? null : theirs === identity.commit;

  return { readings: [web, realtime, database], sameCommit, identity };
}
