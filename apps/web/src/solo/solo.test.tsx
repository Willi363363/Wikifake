/** @vitest-environment jsdom */

// The criterion of the step: a solo game played from a topic to a score.
//
// The step sheet asked for this in a browser, and the browser run belongs to
// step 9.5 — which already owns "Playwright e2e in CI", with the fixture-served
// article and the fake key it needs. What is proved here is the journey itself:
// the topic reaches `start`, the wait ends when the article does, the paragraphs
// the player marks reach `submit` as the numbers the contract says, and the score
// that comes back is on screen.
//
// The two routes are the seam, and they are stubbed at `fetch`. What they *do*
// is phase 4's exit gate and is tested against a real database in
// `src/game/journey.test.ts`; repeating it here would prove the same thing worse.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SoloGame } from './solo.js';
import { SETTLE_MS } from '../lobby/generation.js';

const ROUND = {
  sessionId: 'a-session-handle-16',
  timeLimit: 300,
  topic: 'Chat',
  paragraphs: [
    'Le chat dort seize heures par jour.',
    'Sa vision nocturne est bonne.',
    'Il ronronne en expirant.',
  ],
  totalFakes: 1,
  wikipediaUrl: 'https://fr.wikipedia.org/wiki/Chat',
};

const RESULT = {
  score: 140,
  breakdown: {
    truePositives: 1,
    falsePositives: 1,
    hintsUsed: 0,
    hintPenalty: 0,
    scoreStolen: 0,
    timeBonus: 40,
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

/** What each route answers, in the order the journey calls them. */
function serve(
  answers: Partial<Record<'start' | 'submit' | 'hint', () => Promise<unknown>>>,
): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) => {
      const which = path.endsWith('/start')
        ? 'start'
        : path.endsWith('/hint')
          ? 'hint'
          : 'submit';
      const answer = answers[which];
      if (answer === undefined) throw new Error(`nothing serves ${path}`);
      return answer().then((body) => ({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      })) as unknown as Promise<Response>;
    }),
  );
}

const ok = (body: unknown) => () => Promise.resolve(body);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  cleanup();
});

/** Lets the stubbed promises settle, with the fake clock still in charge. */
async function settle(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

/** Past the generation screen and into the round. */
async function intoTheRound(): Promise<void> {
  await settle();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
}

const paragraph = (at: number) =>
  screen.getByRole('button', { name: new RegExp(ROUND.paragraphs[at] ?? 'nothing') });

describe('7.8 — a topic that is not one', () => {
  it('says so when there is no topic at all', () => {
    render(<SoloGame topic={null} />);
    expect(screen.getByRole('alert').textContent).toContain('No topic');
  });

  it('refuses a topic from the address bar that the route would refuse', () => {
    // The query string is whatever is in the address bar, checked against the
    // same schema the route decodes with rather than by a 400 after a round trip.
    render(<SoloGame topic={'x'.repeat(200)} />);
    expect(screen.getByRole('alert').textContent).toContain('not one we can look up');
  });

  it('asks the server for nothing', () => {
    serve({});
    render(<SoloGame topic="" />);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });
});

describe('7.8 — the wait', () => {
  it('shows the generation screen with the topic, and asks for the round once', async () => {
    serve({ start: ok(ROUND) });
    render(<SoloGame topic="Chat" />);

    expect(
      screen.getByRole('progressbar', { name: 'Generating the round' }),
    ).not.toBeNull();
    expect(screen.getByText('Chat')).not.toBeNull();
    // Solo has no proposer: the player picked it themselves.
    expect(screen.getByText('drawn by the server')).not.toBeNull();

    await settle();
    // Once, whatever React does with mounting: a second call is a second model
    // call and a second bill for a round nobody played.
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toEqual({
      topic: 'Chat',
    });
  });

  it('offers something to play while it waits', () => {
    serve({ start: ok(ROUND) });
    render(<SoloGame topic="Chat" />);
    expect(screen.getByRole('button', { name: 'Play while you wait' })).not.toBeNull();
  });

  it('says what went wrong instead of waiting for an article that is not coming', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          Promise.resolve({
            ok: false,
            status: 404,
            json: () =>
              Promise.resolve({
                code: 'topic_not_found',
                message: 'no article for that',
              }),
          }) as unknown as Promise<Response>,
      ),
    );
    render(<SoloGame topic="Zzzzzz" />);
    await settle();

    expect(screen.getByRole('alert').textContent).toContain('no article for that');
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('7.8 — the round', () => {
  it('shows every paragraph, and how many were altered', async () => {
    serve({ start: ok(ROUND) });
    render(<SoloGame topic="Chat" />);
    await intoTheRound();

    for (const text of ROUND.paragraphs) {
      expect(screen.getByText(new RegExp(text))).not.toBeNull();
    }
    // C1.1 — the count, and never which ones.
    expect(screen.getByText('1 altered')).not.toBeNull();
  });

  it('marks a paragraph, and says so out loud', async () => {
    serve({ start: ok(ROUND) });
    render(<SoloGame topic="Chat" />);
    await intoTheRound();

    expect(paragraph(0).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(paragraph(0));
    expect(paragraph(0).getAttribute('aria-pressed')).toBe('true');
  });

  it('runs the round on the limit the response carried', async () => {
    serve({ start: ok(ROUND) });
    render(<SoloGame topic="Chat" />);
    await intoTheRound();

    expect(screen.getByRole('timer').textContent).toContain('05:00');
  });

  // The rest of the round — the keyboard gesture, the attribution, the brief and
  // the negative assertion — is `src/round/round.test.tsx`: since step 8.1 it is
  // the same screen the room renders. What is asserted here is the journey, which
  // is that the response reached it.
});

describe('7.8 — the score', () => {
  it('sends the marked paragraphs as 1-based numbers, and shows what came back', async () => {
    serve({ start: ok(ROUND), submit: ok(RESULT) });
    render(<SoloGame topic="Chat" />);
    await intoTheRound();

    fireEvent.click(paragraph(0));
    fireEvent.click(paragraph(2));
    fireEvent.click(screen.getByRole('button', { name: /^Submit/ }));
    await settle();

    // C3.3 — the number the player clicked is the number the server grades.
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1]?.[1]?.body))).toEqual({
      sessionId: ROUND.sessionId,
      marked: [1, 3],
    });

    expect(screen.getByText('140')).not.toBeNull();
    expect(screen.getByText('points')).not.toBeNull();
  });

  it('shows the breakdown the server decided, deductions signed', async () => {
    serve({ start: ok(ROUND), submit: ok(RESULT) });
    render(<SoloGame topic="Chat" />);
    await intoTheRound();
    fireEvent.click(screen.getByRole('button', { name: /^Submit/ }));
    await settle();

    expect(screen.getByText('Found').nextElementSibling?.textContent).toBe('1');
    expect(screen.getByText('Wrongly marked').nextElementSibling?.textContent).toBe('−1');
    expect(screen.getByText('Time bonus').nextElementSibling?.textContent).toBe('40');
  });

  it('keeps the solution off the screen — the debrief is phase 8', async () => {
    serve({ start: ok(ROUND), submit: ok(RESULT) });
    render(<SoloGame topic="Chat" />);
    await intoTheRound();
    fireEvent.click(screen.getByRole('button', { name: /^Submit/ }));
    await settle();

    expect(screen.queryByText(/Il en dort douze/)).toBeNull();
    expect(screen.queryByText(/Regardez la durée/)).toBeNull();
  });

  it('offers a way back to the start', async () => {
    serve({ start: ok(ROUND), submit: ok(RESULT) });
    render(<SoloGame topic="Chat" />);
    await intoTheRound();
    fireEvent.click(screen.getByRole('button', { name: /^Submit/ }));
    await settle();

    expect(screen.getByRole('link', { name: 'Play again' }).getAttribute('href')).toBe(
      '/play',
    );
  });

  it('submits by itself when the clock runs out', async () => {
    serve({ start: ok(ROUND), submit: ok(RESULT) });
    render(<SoloGame topic="Chat" />);
    await intoTheRound();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ROUND.timeLimit * 1000);
    });
    await settle();

    // Defect 4 of the debt register, on the solo path: the current game leaves
    // the limit to the client and does nothing when it expires, so a player who
    // walks away never gets a score.
    expect(screen.getByText('140')).not.toBeNull();
  });

  it('submits once, however many times the button is pressed', async () => {
    serve({ start: ok(ROUND), submit: ok(RESULT) });
    render(<SoloGame topic="Chat" />);
    await intoTheRound();

    const submit = screen.getByRole('button', { name: /^Submit/ });
    fireEvent.click(submit);
    fireEvent.click(submit);
    fireEvent.click(submit);
    await settle();

    // The route is idempotent — a second grading hands back the first — but a
    // client that fires three requests on a double-click is a client that will
    // find the one route that is not.
    expect(
      vi.mocked(fetch).mock.calls.filter(([path]) => String(path).endsWith('/submit'))
        .length,
    ).toBe(1);
  });

  it('lets the player try again when the grading was refused', async () => {
    let attempt = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((path: string) => {
        if (String(path).endsWith('/start')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(ROUND),
          }) as unknown as Promise<Response>;
        }
        attempt += 1;
        return Promise.resolve(
          attempt === 1
            ? {
                ok: false,
                status: 503,
                json: () =>
                  Promise.resolve({
                    code: 'generation_failed',
                    message: 'the grading could not be saved',
                  }),
              }
            : { ok: true, status: 200, json: () => Promise.resolve(RESULT) },
        ) as unknown as Promise<Response>;
      }),
    );

    render(<SoloGame topic="Chat" />);
    await intoTheRound();
    fireEvent.click(screen.getByRole('button', { name: /^Submit/ }));
    await settle();

    expect(screen.getByRole('alert').textContent).toContain('could not be saved');

    fireEvent.click(screen.getByRole('button', { name: /^Submit/ }));
    await settle();
    expect(screen.getByText('140')).not.toBeNull();
  });
});

describe('8.2 — hints, in solo', () => {
  const NUDGE = {
    falseInfoNumber: 1,
    hint: 'Regardez la durée annoncée.',
    charged: 50,
    hintPenalty: 50,
    grant: { level: 1 },
  };

  const buyAHint = (): void => {
    fireEvent.click(screen.getByRole('button', { name: /^Intel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Buy a hint on target 1' }));
  };

  it('buys against a target number, over the round’s session', async () => {
    serve({ start: ok(ROUND), hint: ok(NUDGE) });
    render(<SoloGame topic="Chat" />);
    await intoTheRound();
    buyAHint();
    await settle();

    const hinted = vi
      .mocked(fetch)
      .mock.calls.find(([path]) => String(path).endsWith('/hint'));
    expect(JSON.parse(String(hinted?.[1]?.body))).toEqual({
      sessionId: ROUND.sessionId,
      falseInfoNumber: 1,
      level: 1,
    });
  });

  it('shows what the server granted, and what the server says it cost', async () => {
    serve({ start: ok(ROUND), hint: ok(NUDGE) });
    render(<SoloGame topic="Chat" />);
    await intoTheRound();
    buyAHint();
    await settle();

    expect(screen.getByRole('dialog').textContent).toContain('Regardez la durée');
    expect(screen.getByRole('dialog').textContent).toContain('spent 50');
  });

  it('the penalty it shows is the one the submission subtracts', async () => {
    // C1.3, end to end on the solo path: the hint the server billed is the hint
    // the breakdown accounts for, and neither number was worked out here.
    serve({
      start: ok(ROUND),
      hint: ok(NUDGE),
      submit: ok({
        ...RESULT,
        breakdown: { ...RESULT.breakdown, hintsUsed: 1, hintPenalty: 50 },
      }),
    });
    render(<SoloGame topic="Chat" />);
    await intoTheRound();
    buyAHint();
    await settle();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await settle();

    expect(screen.getByText('Hint penalty').nextElementSibling?.textContent).toBe('−50');
    expect(screen.getByText('Hints used').nextElementSibling?.textContent).toBe('1');
  });
});
