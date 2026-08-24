import { describe, expect, it } from 'vitest';

import { decode } from '../decode.js';
import { ERROR_CODES } from '../errors.js';
import * as server from './outgoing.js';
import { OUTGOING_TYPES, outgoingMessage } from './outgoing.js';

const ARTICLE = {
  topic: 'Paris',
  paragraphs: [
    'Paris est la capitale de la France.',
    'La ville compte deux arrondissements.',
  ],
  totalFakes: 1,
  wikipediaUrl: 'https://fr.wikipedia.org/wiki/Paris',
};

const SOLUTION = [
  {
    paragraphIndex: 2,
    falseInfoNumber: 1,
    falseStatement: 'La ville compte deux arrondissements.',
    explanation: 'Paris compte vingt arrondissements.',
    hint: 'Vérifiez le nombre.',
  },
];

const GAME_START = {
  type: 'game_start',
  ...ARTICLE,
  players: [{ name: 'ada', colour: '#e63946' }],
  withItems: true,
  timeLimit: 300,
};

const HINT_UNLOCKED = {
  type: 'hint_unlocked',
  falseInfoNumber: 1,
  hint: 'Vérifiez le nombre.',
  cost: 50,
  hintPenalty: 50,
  grant: { level: 1 },
};

const GAME_END = {
  type: 'game_end',
  leaderboard: [
    {
      player: 'ada',
      colour: '#e63946',
      score: 400,
      breakdown: {
        truePositives: 3,
        falsePositives: 1,
        timeBonus: 100,
        hintsUsed: 1,
        hintPenalty: 20,
      },
    },
  ],
  solution: SOLUTION,
};

/** One valid message per outbound type, minimal. */
const VALID: Readonly<Record<string, unknown>> = {
  lobby_update: {
    type: 'lobby_update',
    players: [
      { name: 'ada', colour: '#e63946', ready: true, answered: false, isHost: true },
    ],
  },
  theme_vote_start: { type: 'theme_vote_start' },
  theme_vote_update: { type: 'theme_vote_update', submitted: ['ada'], total: 2 },
  theme_selected: {
    type: 'theme_selected',
    topic: 'Paris',
    proposer: 'ada',
    ballots: { ada: 'Paris' },
  },
  game_start: GAME_START,
  live_score_update: { type: 'live_score_update', player: 'ada', score: 150 },
  cursor_update: { type: 'cursor_update', player: 'ada', x: 0.5, y: 0.5 },
  chat_message: { type: 'chat_message', sender: 'ada', content: 'bien joué' },
  items_distributed: {
    type: 'items_distributed',
    wave: 1,
    items: { ada: { instanceId: 'ada_1_SCANNER', itemId: 'SCANNER' } },
  },
  item_effect: { type: 'item_effect', itemId: 'BLUR', from: 'bob' },
  item_used: { type: 'item_used', player: 'bob', itemId: 'BLUR', targets: ['ada'] },
  hint_unlocked: HINT_UNLOCKED,
  scanner_result: { type: 'scanner_result', paragraphIndex: 2 },
  game_end: GAME_END,
  error: { type: 'error', code: 'not_host', message: 'only the host can do that' },
};

describe('the outbound catalogue', () => {
  it('announces fifteen messages', () => {
    expect(OUTGOING_TYPES).toHaveLength(15);
  });

  it('has a valid fixture for every announced type, and no fixture beyond them', () => {
    expect(Object.keys(VALID).sort()).toEqual([...OUTGOING_TYPES].sort());
  });

  it.each(Object.entries(VALID))('accepts %s', (_type, message) => {
    const result = decode(outgoingMessage, message);
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });
});

describe('game_start announces the players one way (D3)', () => {
  // The two start paths disagree today: one sends a list of nicknames, the
  // other objects with a colour. The client has to accept both.
  it('refuses the bare list of nicknames', () => {
    const result = decode(server.gameStart, {
      ...GAME_START,
      players: ['ada', 'bob'],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]).toMatch(/^players\.0: /);
  });

  it('keeps the enveloping `data` key out: the payload is flat', () => {
    expect(decode(server.gameStart, { type: 'game_start', data: GAME_START }).ok).toBe(
      false,
    );
  });
});

describe('game_start cannot carry the solution (C1.1)', () => {
  // Zod strips what a schema does not declare, so a position spread into the
  // start payload disappears on the way out rather than reaching a console.
  it('drops the solution, the explanations and the hints', () => {
    const leaked = {
      ...GAME_START,
      positions: SOLUTION,
      misinformations: SOLUTION,
      originalText: 'Paris compte vingt arrondissements.',
      hints: ['Vérifiez le nombre.'],
    };
    const parsed = server.gameStart.parse(leaked);
    const serialised = JSON.stringify(parsed);

    expect(Object.keys(parsed).sort()).toEqual([
      'paragraphs',
      'players',
      'timeLimit',
      'topic',
      'totalFakes',
      'type',
      'wikipediaUrl',
      'withItems',
    ]);
    for (const forbidden of [
      'vingt arrondissements',
      'Vérifiez le nombre',
      'originalText',
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });
});

describe('hint_unlocked (C1.2, C1.4)', () => {
  it('reveals the truth at level 2', () => {
    const message = {
      ...HINT_UNLOCKED,
      cost: 200,
      hintPenalty: 200,
      grant: {
        level: 2,
        truth: 'Paris compte vingt arrondissements.',
        paragraphIndex: 2,
      },
    };
    expect(decode(server.hintUnlocked, message).ok).toBe(true);
  });

  it('cannot ship the truth at level 1', () => {
    const result = decode(server.hintUnlocked, {
      ...HINT_UNLOCKED,
      grant: {
        level: 1,
        truth: 'Paris compte vingt arrondissements.',
        paragraphIndex: 2,
      },
    });
    // Level 1 declares no truth, so the extra keys are stripped rather than
    // carried: what matters is that the parsed message holds no truth.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(JSON.stringify(result.value)).not.toContain('vingt arrondissements');
  });

  it('cannot half-form a level 2 reveal', () => {
    for (const grant of [
      { level: 2, truth: 'x' },
      { level: 2, paragraphIndex: 2 },
      { level: 2 },
    ]) {
      expect(decode(server.hintUnlocked, { ...HINT_UNLOCKED, grant }).ok).toBe(false);
    }
  });

  it('refuses a level that is not 1 or 2', () => {
    expect(
      decode(server.hintUnlocked, { ...HINT_UNLOCKED, grant: { level: 3 } }).ok,
    ).toBe(false);
  });
});

describe('scanner_result (C1.6)', () => {
  it('says null when every fake has been found', () => {
    expect(
      decode(server.scannerResult, { type: 'scanner_result', paragraphIndex: null }).ok,
    ).toBe(true);
  });

  it('still refuses a 0-based index', () => {
    expect(
      decode(server.scannerResult, { type: 'scanner_result', paragraphIndex: 0 }).ok,
    ).toBe(false);
  });
});

describe('theme_selected', () => {
  it('says null rather than a magic proposer name', () => {
    expect(
      decode(server.themeSelected, {
        type: 'theme_selected',
        topic: 'Paris',
        proposer: null,
        ballots: {},
      }).ok,
    ).toBe(true);
  });

  it('refuses a ballot keyed by something that is not a nickname', () => {
    expect(
      decode(server.themeSelected, {
        type: 'theme_selected',
        topic: 'Paris',
        proposer: null,
        ballots: { 'ada/eve': 'Paris' },
      }).ok,
    ).toBe(false);
  });
});

describe('game_end', () => {
  it('accepts a player who never submitted', () => {
    const message = {
      ...GAME_END,
      leaderboard: [{ player: 'bob', colour: '#264653', score: 0, breakdown: null }],
    };
    expect(decode(server.gameEnd, message).ok).toBe(true);
  });

  it('refuses an empty solution: a round always had at least one fake', () => {
    expect(decode(server.gameEnd, { ...GAME_END, solution: [] }).ok).toBe(false);
  });
});

describe('error', () => {
  it.each(ERROR_CODES)('carries %s', (code) => {
    expect(decode(server.errorMessage, { type: 'error', code, message: 'nope' }).ok).toBe(
      true,
    );
  });

  it('refuses a code outside the union', () => {
    const result = decode(server.errorMessage, {
      type: 'error',
      code: 'something_went_wrong',
      message: 'nope',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]).toMatch(/^code: /);
  });

  // Today three of the server's errors carry a sentence and no code at all, so
  // a client cannot branch on them.
  it('refuses an error with no code', () => {
    expect(
      decode(server.errorMessage, { type: 'error', message: 'Mot-clé introuvable.' }).ok,
    ).toBe(false);
  });
});
