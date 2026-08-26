// The two calls, and every way they can fail.
//
// `fetch` is the seam: what these functions do is decode, so what is worth
// asserting is what they make of an answer. A route that returns the wrong shape,
// a refusal with a sentence in it, a body that is not JSON at all, a network that
// is not there — each has a different answer for the player, and none of them
// may be a thrown exception in the middle of a render.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { startRound, submitRound } from './api.js';

const ROUND = {
  sessionId: 'a-session-handle-16',
  timeLimit: 300,
  topic: 'Chat',
  paragraphs: ['Le chat dort seize heures par jour.', 'Sa vision nocturne est bonne.'],
  totalFakes: 1,
  wikipediaUrl: 'https://fr.wikipedia.org/wiki/Chat',
};

const RESULT = {
  score: 120,
  breakdown: {
    truePositives: 1,
    falsePositives: 0,
    hintsUsed: 0,
    hintPenalty: 0,
    scoreStolen: 0,
    timeBonus: 20,
  },
  solution: [
    {
      paragraphIndex: 1,
      falseInfoNumber: 1,
      falseStatement: 'Le chat dort seize heures par jour.',
      explanation: 'Il en dort douze.',
      hint: 'Regardez la durée.',
    },
  ],
};

/** Answers the next `fetch` with this status and body. */
function answering(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json: () => Promise.resolve(body),
        }) as unknown as Promise<Response>,
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('7.8 — starting a round', () => {
  it('hands back what the route encoded', async () => {
    answering(200, ROUND);
    const answered = await startRound({ topic: 'Chat' });

    expect(answered).toEqual({ ok: true, value: ROUND });
  });

  it('posts the topic as the route asks for it', async () => {
    answering(200, ROUND);
    await startRound({ topic: 'Chat', timeLimit: 120 });

    const called = vi.mocked(fetch).mock.calls[0];
    expect(called?.[0]).toBe('/api/game/start');
    expect(called?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(called?.[1]?.body))).toEqual({
      topic: 'Chat',
      timeLimit: 120,
    });
  });

  it('passes the server’s own sentence on', async () => {
    // "no article found for that topic" is a thing a player can act on; 404 is
    // not, and the current entry screen reads this field with a cast.
    answering(404, { code: 'topic_not_found', message: 'no article for that topic' });
    const answered = await startRound({ topic: 'Zzzz' });

    expect(answered).toEqual({ ok: false, message: 'no article for that topic' });
  });

  it('refuses a payload it cannot read', async () => {
    // The shape matters here more than anywhere: this is the one response that
    // must not carry the solution (C1.1), and a client that reads whatever it
    // finds would keep working if it did.
    answering(200, { ...ROUND, totalFakes: 'one' });
    const answered = await startRound({ topic: 'Chat' });

    expect(answered.ok).toBe(false);
  });

  it('refuses a payload missing the session handle', async () => {
    const { sessionId: _gone, ...without } = ROUND;
    answering(200, without);

    expect((await startRound({ topic: 'Chat' })).ok).toBe(false);
  });

  it('says the server could not be reached, rather than throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    const answered = await startRound({ topic: 'Chat' });

    expect(answered).toEqual({ ok: false, message: 'the server could not be reached' });
  });

  it('falls back to a sentence of its own when the code is not one of ours', async () => {
    // A gateway, a proxy or an old deployment answering something shaped like an
    // error but not this contract's. `restError` closes the union of codes, so
    // this one does not decode — and prose the client cannot branch on is not
    // shown as though it came from the game.
    answering(502, { code: 'upstream_exploded', message: 'Bad Gateway' });
    const answered = await startRound({ topic: 'Chat' });

    expect(answered).toEqual({ ok: false, message: 'the server refused the request' });
  });

  it('survives a refusal whose body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          Promise.resolve({
            ok: false,
            status: 502,
            json: () => Promise.reject(new Error('not json')),
          }) as unknown as Promise<Response>,
      ),
    );
    const answered = await startRound({ topic: 'Chat' });

    expect(answered.ok).toBe(false);
  });
});

describe('7.8 — submitting', () => {
  it('hands back the score, the breakdown and the solution', async () => {
    answering(200, RESULT);
    const answered = await submitRound({ sessionId: ROUND.sessionId, marked: [1] });

    expect(answered).toEqual({ ok: true, value: RESULT });
  });

  it('posts the handle and the marked paragraphs, and nothing else', async () => {
    answering(200, RESULT);
    await submitRound({ sessionId: ROUND.sessionId, marked: [1, 3] });

    // C1.3 — there is no field for a penalty to travel in. The assertion is on
    // the whole body for that reason.
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toEqual({
      sessionId: ROUND.sessionId,
      marked: [1, 3],
    });
  });

  it('passes a refusal on', async () => {
    answering(404, { code: 'session_not_found', message: 'that round is over' });
    const answered = await submitRound({ sessionId: ROUND.sessionId, marked: [] });

    expect(answered).toEqual({ ok: false, message: 'that round is over' });
  });

  it('refuses a breakdown with a field missing', async () => {
    const { timeBonus: _gone, ...short } = RESULT.breakdown;
    answering(200, { ...RESULT, breakdown: short });

    expect((await submitRound({ sessionId: ROUND.sessionId, marked: [] })).ok).toBe(
      false,
    );
  });
});
