// Step O.4 — a generation ends, one way or the other.
//
// The defect this file holds shut is written up in
// `plans/current-state/12-realtime-debt.md`, and its shape is the interesting
// part. `server.ts` already guarded the multiplayer generation with a `.catch`,
// and the comment above that catch names the failure it is for: *"a room left in
// `generating` waits for an article that is not coming — which is exactly the
// state the current server gets stuck in."*
//
// **A hang is not a rejection.** Nothing in the chain carried a deadline: no
// `AbortSignal` on the two Wikipedia calls, none on the model call. So Wikipedia
// or the model answering slowly and never finishing produced no exception at
// all, the catch never ran, `article_ready` never arrived, and the room waited
// for its idle alarm an hour later. Solo had the same shape with a different
// victim: the request was held until the platform cut it.
//
// Every case below **hangs for ever** without the fix, which is why they are
// written against a short deadline rather than the real forty-five seconds.
import { describe, expect, it } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';

import { sourceArticle, GENERATION_DEADLINE_MS } from './source.js';
import type { WikiTransport } from './mediawiki.js';
import { falsifier, PAGE, SEARCH, wikipedia } from './testing/round.js';

const WIKI = { language: 'fr', userAgent: 'wikifake-test/1.0 (test@example.test)' };

/**
 * What the chain is handed when nothing about it should fail.
 *
 * A function rather than a constant: `wikipedia()` counts the calls it has
 * answered, so a shared one would have the second case reading the first's
 * page — which is how the first draft of this file had a passing round fail for
 * a reason that had nothing to do with a deadline.
 */
const working = () => ({
  cache: null,
  model: falsifier(),
  wiki: WIKI,
  transport: wikipedia([SEARCH, PAGE]),
  seed: () => 1,
});

/**
 * A transport that never answers, and honours the signal it is given.
 *
 * Which is exactly what `fetch` does: it waits as long as the other end keeps
 * the socket open, and aborts only when asked to. Before step O.4 nothing asked.
 */
function silentWikipedia(): WikiTransport {
  return {
    fetch: (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      }),
  };
}

/** A model that never answers, and honours the signal `generateText` passes it. */
function silentModel(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: (options) =>
      new Promise((_resolve, reject) => {
        options.abortSignal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      }),
  });
}

describe('O.4 — the deadline', () => {
  it('is long enough to be generous and short enough to be a bound', () => {
    // Stated rather than assumed: a number that drifts under a slow model turns
    // a legitimate round into a refusal, and one that drifts up stops bounding
    // anything a player would notice.
    expect(GENERATION_DEADLINE_MS).toBeGreaterThanOrEqual(30_000);
    expect(GENERATION_DEADLINE_MS).toBeLessThanOrEqual(60_000);
  });

  it('turns a Wikipedia that never answers into a refusal', async () => {
    const outcome = await sourceArticle(
      { ...working(), transport: silentWikipedia(), deadlineMs: 50 },
      'chat',
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    // `unreachable` rather than a missing topic: no page is coming, and trying
    // the next candidate would be trying it against the same silence.
    expect(outcome.reason).toBe('wikipedia_unreachable');
    // Nothing was sent to the model, so there is nothing to bill.
    expect(outcome.calls).toEqual([]);
  });

  it('turns a model that never answers into a refusal, and still bills it', async () => {
    const outcome = await sourceArticle(
      { ...working(), model: silentModel(), deadlineMs: 50 },
      'chat',
    );

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('falsification_failed');
    // C4.5 — the call was made and the tokens were spent, so it is recorded on
    // the failing path too. A deadline that made failures free would make the
    // cost of failure invisible, which is the state `/api/usage` was built to
    // leave.
    expect(outcome.calls).toHaveLength(1);
    expect(outcome.calls[0]?.failed).toBe(true);
  });

  it('is one deadline for the chain, not one per call', async () => {
    // Two slow calls that each finish inside the bound must still fail together
    // when their *sum* does not. Otherwise three bounded steps are three times
    // the bound, and the promise the number makes is not the one it keeps.
    let answered = 0;
    const slowly: WikiTransport = {
      fetch: (_url, options) =>
        new Promise((resolve, reject) => {
          const at = answered++;
          const timer = setTimeout(() => {
            resolve(
              new Response(JSON.stringify(at === 0 ? SEARCH : PAGE), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
            );
          }, 60);
          options?.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    };

    const outcome = await sourceArticle(
      { ...working(), transport: slowly, deadlineMs: 90 },
      'chat',
    );

    // The search fits in 90ms; the search plus the page does not.
    expect(answered).toBe(2);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toBe('wikipedia_unreachable');
  });

  it('leaves a round that answers in time alone', async () => {
    const outcome = await sourceArticle({ ...working(), deadlineMs: 5000 }, 'chat');

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.entry.article.topic).toBe('Chat');
    expect(outcome.value.fromCache).toBe(false);
  });
});
