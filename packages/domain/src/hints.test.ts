import { describe, expect, it } from 'vitest';
import { clientMessages, serverMessages } from '@wikifake/protocol';

import {
  EMPTY_LEDGER,
  grantHint,
  hintPenaltyFor,
  hintsUsedFor,
  type HintLedger,
} from './hints.js';
import { gradeSubmission } from './scoring.js';
import { HINT_COST, REVEAL_COST } from './scoring.js';

const SOLUTION = [
  {
    paragraphIndex: 2,
    falseInfoNumber: 1,
    falseStatement: 'La ville compte deux arrondissements.',
    explanation: 'Paris compte vingt arrondissements.',
    hint: 'Vérifiez le nombre.',
  },
  {
    paragraphIndex: 5,
    falseInfoNumber: 2,
    falseStatement: 'La Seine se jette dans la Méditerranée.',
    explanation: 'La Seine se jette dans la Manche.',
    hint: 'Vérifiez la mer.',
  },
];

/** Grants a sequence of requests, returning the final ledger and every payload. */
function buy(requests: readonly { falseInfoNumber: number; level: 1 | 2 }[]) {
  let ledger: HintLedger = EMPTY_LEDGER;
  const payloads = [];
  for (const request of requests) {
    const grant = grantHint(SOLUTION, ledger, request);
    if (!grant.ok) throw new Error(`unexpected refusal: ${grant.code}`);
    ledger = grant.ledger;
    payloads.push(grant.payload);
  }
  return { ledger, payloads };
}

describe('C2.2 — the penalty is not cumulative', () => {
  it('charges 200 for a reveal, not 250', () => {
    const { ledger } = buy([{ falseInfoNumber: 1, level: 2 }]);
    expect(hintPenaltyFor(ledger)).toBe(REVEAL_COST);
  });

  it('charges 200 for a reveal bought after the nudge, not 250', () => {
    const { ledger } = buy([
      { falseInfoNumber: 1, level: 1 },
      { falseInfoNumber: 1, level: 2 },
    ]);
    expect(hintPenaltyFor(ledger)).toBe(REVEAL_COST);
  });

  it('adds up across different falsifications', () => {
    const { ledger } = buy([
      { falseInfoNumber: 1, level: 2 },
      { falseInfoNumber: 2, level: 1 },
    ]);
    expect(hintPenaltyFor(ledger)).toBe(REVEAL_COST + HINT_COST);
  });

  it('costs nothing when nothing was bought', () => {
    expect(hintPenaltyFor(EMPTY_LEDGER)).toBe(0);
  });
});

describe('C1.4 — levels are monotonic', () => {
  // The player already knows the truth. Re-serving the nudge and charging for it
  // would be charging for something they cannot un-know.
  it('returns level 2 when level 1 is asked for after a reveal', () => {
    const { payloads } = buy([
      { falseInfoNumber: 1, level: 2 },
      { falseInfoNumber: 1, level: 1 },
    ]);
    expect(payloads[1]?.grant.level).toBe(2);
  });

  it('does not bill that second request', () => {
    const { payloads, ledger } = buy([
      { falseInfoNumber: 1, level: 2 },
      { falseInfoNumber: 1, level: 1 },
    ]);
    expect(payloads[1]?.charged).toBe(0);
    expect(hintPenaltyFor(ledger)).toBe(REVEAL_COST);
  });

  it('does not bill a repeated reveal', () => {
    const { payloads, ledger } = buy([
      { falseInfoNumber: 1, level: 2 },
      { falseInfoNumber: 1, level: 2 },
      { falseInfoNumber: 1, level: 2 },
    ]);
    expect(payloads.map((payload) => payload.charged)).toEqual([REVEAL_COST, 0, 0]);
    expect(hintPenaltyFor(ledger)).toBe(REVEAL_COST);
  });

  it('does not bill a repeated nudge', () => {
    const { payloads, ledger } = buy([
      { falseInfoNumber: 1, level: 1 },
      { falseInfoNumber: 1, level: 1 },
    ]);
    expect(payloads.map((payload) => payload.charged)).toEqual([HINT_COST, 0]);
    expect(hintPenaltyFor(ledger)).toBe(HINT_COST);
  });

  it('bills only the difference when upgrading', () => {
    const { payloads } = buy([
      { falseInfoNumber: 1, level: 1 },
      { falseInfoNumber: 1, level: 2 },
    ]);
    expect(payloads.map((payload) => payload.charged)).toEqual([
      HINT_COST,
      REVEAL_COST - HINT_COST,
    ]);
  });
});

describe('what the client is told it paid adds up', () => {
  // The invariant that makes `charged` trustworthy: a client that sums what it
  // was charged reaches the penalty the server will apply. The current protocol
  // sends the price of the level instead, so the same sum over-counts.
  it.each([
    [[{ falseInfoNumber: 1, level: 2 as const }]],
    [
      [
        { falseInfoNumber: 1, level: 1 as const },
        { falseInfoNumber: 1, level: 2 as const },
        { falseInfoNumber: 1, level: 1 as const },
      ],
    ],
    [
      [
        { falseInfoNumber: 1, level: 1 as const },
        { falseInfoNumber: 2, level: 2 as const },
        { falseInfoNumber: 2, level: 2 as const },
        { falseInfoNumber: 1, level: 2 as const },
      ],
    ],
  ])('the charges sum to the penalty (%#)', (requests) => {
    const { payloads, ledger } = buy(requests);
    const summed = payloads.reduce((total, payload) => total + payload.charged, 0);
    expect(summed).toBe(hintPenaltyFor(ledger));
    expect(payloads.at(-1)?.hintPenalty).toBe(hintPenaltyFor(ledger));
  });
});

describe('C1.4 — a hint is never transmitted before payment', () => {
  it('carries the nudge but no truth at level 1', () => {
    const { payloads } = buy([{ falseInfoNumber: 1, level: 1 }]);
    const serialised = JSON.stringify(payloads[0]);
    expect(serialised).toContain('Vérifiez le nombre.');
    expect(serialised).not.toContain('vingt arrondissements');
  });

  it('carries the truth once the reveal is paid for', () => {
    const { payloads } = buy([{ falseInfoNumber: 1, level: 2 }]);
    expect(JSON.stringify(payloads[0])).toContain('vingt arrondissements');
  });

  // The payload is the protocol's, so a granted hint validates as the real
  // message rather than as something shaped roughly like it.
  it('validates as a hint_unlocked message', () => {
    const { payloads } = buy([{ falseInfoNumber: 2, level: 2 }]);
    expect(
      serverMessages.hintUnlocked.safeParse({ ...payloads[0], type: 'hint_unlocked' })
        .success,
    ).toBe(true);
  });
});

describe('a number that does not exist', () => {
  it('is refused with a code rather than silently ignored', () => {
    const grant = grantHint(SOLUTION, EMPTY_LEDGER, { falseInfoNumber: 9, level: 1 });
    expect(grant).toEqual({ ok: false, code: 'hint_not_found' });
  });

  it('leaves the ledger alone', () => {
    const { ledger } = buy([{ falseInfoNumber: 1, level: 2 }]);
    grantHint(SOLUTION, ledger, { falseInfoNumber: 9, level: 1 });
    expect(hintPenaltyFor(ledger)).toBe(REVEAL_COST);
  });
});

describe('the ledger is not mutated', () => {
  // The rules decide, they do not apply: a granted hint returns the next ledger
  // rather than editing the one it was handed.
  it('returns a new ledger and leaves the old one intact', () => {
    const first = grantHint(SOLUTION, EMPTY_LEDGER, { falseInfoNumber: 1, level: 1 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(hintPenaltyFor(EMPTY_LEDGER)).toBe(0);
    expect(hintPenaltyFor(first.ledger)).toBe(HINT_COST);
  });
});

describe('C1.3 — a client cannot declare its own penalty', () => {
  // The criterion of step 1.5: `hintsUsed: 9` declared by the client produces a
  // breakdown of zero. It cannot even be declared — the submission schema has no
  // field for it — and the breakdown is computed from the ledger.
  it('drops the declaration and reports the ledger', () => {
    const parsed = clientMessages.submitAnswer.parse({
      type: 'submit_answer',
      marked: [2],
      hintsUsed: 9,
      hintPenalty: 9_999,
      scoreStolen: -100_000,
    });
    expect(parsed).toEqual({ type: 'submit_answer', marked: [2] });

    const { breakdown } = gradeSubmission({
      truePositives: 1,
      falsePositives: 0,
      hintsUsed: hintsUsedFor(EMPTY_LEDGER),
      hintPenalty: hintPenaltyFor(EMPTY_LEDGER),
      scoreStolen: 0,
      timeLimitSeconds: 300,
      elapsedSeconds: 300,
    });
    expect(breakdown.hintsUsed).toBe(0);
    expect(breakdown.hintPenalty).toBe(0);
  });

  it('counts what the ledger actually holds', () => {
    const { ledger } = buy([
      { falseInfoNumber: 1, level: 2 },
      { falseInfoNumber: 2, level: 1 },
      { falseInfoNumber: 2, level: 1 },
    ]);
    expect(hintsUsedFor(ledger)).toBe(2);
    expect(hintPenaltyFor(ledger)).toBe(REVEAL_COST + HINT_COST);
  });
});
