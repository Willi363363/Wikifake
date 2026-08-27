// C1.1 — the solution never leaves the server before the round ends.
//
// This is the most important test in the package, and the reason the start
// payload is a schema rather than an object literal. The guarantee was paid for
// in production: the payload used to carry `positions`, `misinformations` and
// `original_text`, and a diff between the original and the falsified paragraph
// was enough to solve the game without reading it.
//
// It is checked the way `plans/rewrite/01-contract-to-preserve.md` asks — by
// **keys and by values** — on both transports, because the same round starts
// over REST in solo and over the socket in multiplayer, and a leak on one is a
// leak.
import { describe, expect, it } from 'vitest';

import { startGameResponse, submitResponse, hintResponse } from './rest/game.js';
import { serverMessages } from './index.js';

/**
 * The markers below are unique strings. Searching for them in the serialised
 * payload is what makes the "by values" half of the assertion real: a substring
 * check on natural prose would pass by accident.
 */
const TRUTH = 'TRUTHMARKER-Paris-has-twenty-arrondissements';
const HINT = 'HINTMARKER-check-the-number';
const ORIGINAL = 'ORIGINALMARKER-the-unfalsified-sentence';

/** A complete generated game, exactly as the generator hands it over. */
const GENERATED = {
  topic: 'Paris',
  paragraphs: [
    'Paris est la capitale de la France.',
    'La ville compte deux arrondissements.',
    'La Seine traverse la ville.',
  ],
  totalFakes: 1,
  wikipediaUrl: 'https://fr.wikipedia.org/wiki/Paris',

  // Everything below is the solution, and must not survive the schema.
  positions: [
    {
      paragraphIndex: 2,
      falseInfoNumber: 1,
      falseStatement: 'La ville compte deux arrondissements.',
      explanation: TRUTH,
      hint: HINT,
    },
  ],
  misinformations: [{ paragraphIndex: 1, originalText: ORIGINAL, swappedText: 'deux' }],
  originalText: ORIGINAL,
  html: `<p>${ORIGINAL}</p>`,
  totalFalseStatements: 1,
};

const FORBIDDEN_VALUES = [TRUTH, HINT, ORIGINAL];
const FORBIDDEN_KEYS = [
  'positions',
  'misinformations',
  'originalText',
  'original_text',
  'explanation',
  'hint',
  'hints',
  'falseStatement',
  'solution',
  'html',
];

/** Every key of an object graph, at any depth. */
function allKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, found);
    return found;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      found.push(key);
      allKeys(nested, found);
    }
  }
  return found;
}

describe('the round-start payload cannot carry the solution', () => {
  const payloads = {
    'REST — POST /api/game/start': startGameResponse.parse({
      ...GENERATED,
      sessionId: 'aBcDeFgHiJkLmNoP',
      timeLimit: 300,
    }),
    'WebSocket — game_start': serverMessages.gameStart.parse({
      ...GENERATED,
      type: 'game_start',
      players: [{ name: 'ada', colour: '#e63946' }],
      withItems: true,
      timeLimit: 300,
    }),
  };

  it.each(Object.entries(payloads))('%s carries no forbidden key', (_name, payload) => {
    const keys = allKeys(payload);
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(keys, `key "${forbidden}" survived`).not.toContain(forbidden);
    }
  });

  it.each(Object.entries(payloads))(
    '%s carries no truth and no hint text',
    (_name, payload) => {
      const serialised = JSON.stringify(payload);
      for (const forbidden of FORBIDDEN_VALUES) {
        expect(serialised, `value "${forbidden}" survived`).not.toContain(forbidden);
      }
    },
  );

  it.each(Object.entries(payloads))(
    '%s still says how many fakes there are',
    (_name, payload) => {
      expect(payload).toMatchObject({ totalFakes: 1 });
    },
  );

  // The falsified paragraph is what the player reads: it has to be there. The
  // test would be worthless if it passed by emptying the payload.
  it.each(Object.entries(payloads))('%s still carries the article', (_name, payload) => {
    expect(JSON.stringify(payload)).toContain('La ville compte deux arrondissements.');
  });
});

describe('a level-1 hint reveals nothing (C1.4)', () => {
  it('carries the hint text but not the truth', () => {
    const parsed = hintResponse.parse({
      falseInfoNumber: 1,
      hint: HINT,
      charged: 50,
      hintPenalty: 50,
      grant: { level: 1, truth: TRUTH, paragraphIndex: 2 },
    });
    const serialised = JSON.stringify(parsed);
    expect(serialised).toContain(HINT);
    expect(serialised).not.toContain(TRUTH);
  });

  it('carries the truth once level 2 is paid for', () => {
    const parsed = hintResponse.parse({
      falseInfoNumber: 1,
      hint: HINT,
      charged: 200,
      hintPenalty: 200,
      grant: { level: 2, truth: TRUTH, paragraphIndex: 2 },
    });
    expect(JSON.stringify(parsed)).toContain(TRUTH);
  });
});

describe('the solution arrives at the end, and only there (C1.2)', () => {
  it('the submission response carries it in full', () => {
    const parsed = submitResponse.parse({
      score: 400,
      breakdown: {
        truePositives: 1,
        falsePositives: 0,
        hintsUsed: 0,
        hintPenalty: 0,
        scoreStolen: 0,
        timeBonus: 100,
      },
      solution: GENERATED.positions,
    });
    const serialised = JSON.stringify(parsed);
    expect(serialised).toContain(TRUTH);
    expect(serialised).toContain(HINT);
  });

  it('the round-end message carries it in full', () => {
    const parsed = serverMessages.gameEnd.parse({
      type: 'game_end',
      leaderboard: [{ player: 'ada', colour: '#e63946', score: 400, breakdown: null }],
      solution: GENERATED.positions,
    });
    expect(JSON.stringify(parsed)).toContain(TRUTH);
  });
});
