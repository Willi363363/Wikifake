// D8 — the scoring scale exists three times today.
//
// `backend/src/scoring.py` for both game modes, `frontend/src/config.js` for the
// optimistic live score, and `STEAL_AMOUNT` off on its own in
// `backend/src/realtime/items.py`. Nothing kept them in step: they agreed by
// habit, and a change to one was a change to one.
//
// This package is the fourth and last, and it is the one the contract names. So
// this test does not derive anything from the other three — it asserts they
// still agree with C2.1, for as long as they exist. A disagreement means a
// player's live score and their final score come from different rules, which is
// exactly the bug that made a debrief unexplainable.
//
// The frontend copy goes in phase 8 and the Python in phase 10; this file goes
// with whichever leaves last.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  HINT_COST,
  PER_FALSE_POSITIVE,
  PER_TRUE_POSITIVE,
  REVEAL_COST,
  STEAL_AMOUNT,
  TIME_BONUS_PER_SECOND,
} from './scoring.js';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));

function read(path: string): string {
  return readFileSync(`${REPO}${path}`, 'utf8');
}

/** Reads `NAME = 150` out of Python, or `name: 150` out of JavaScript. */
function constant(source: string, name: string): number {
  const match = new RegExp(`${name}\\s*[:=]\\s*(-?[0-9.]+)`).exec(source);
  if (!match?.[1]) throw new Error(`constant ${name} not found`);
  return Number(match[1]);
}

describe('the Python scale agrees with C2.1', () => {
  const python = read('backend/src/scoring.py');

  it.each([
    ['PER_CORRECT', PER_TRUE_POSITIVE],
    ['PER_FALSE_POSITIVE', PER_FALSE_POSITIVE],
    ['TIME_BONUS_PER_SECOND', TIME_BONUS_PER_SECOND],
    ['HINT_COST', HINT_COST],
    ['REVEAL_COST', REVEAL_COST],
  ])('%s is %s', (name, expected) => {
    expect(constant(python, name)).toBe(expected);
  });

  it('STEAL_AMOUNT agrees, from the item module it lives in', () => {
    expect(constant(read('backend/src/realtime/items.py'), 'STEAL_AMOUNT')).toBe(
      STEAL_AMOUNT,
    );
  });
});

describe('the frontend copy agrees with C2.1', () => {
  const config = read('frontend/src/config.js');

  it.each([
    ['perCorrect', PER_TRUE_POSITIVE],
    ['perFalsePositive', PER_FALSE_POSITIVE],
    ['timeBonusPerSecond', TIME_BONUS_PER_SECOND],
    ['hintCost', HINT_COST],
    ['revealCost', REVEAL_COST],
  ])('%s is %s', (name, expected) => {
    expect(constant(config, name)).toBe(expected);
  });
});
