import { describe, expect, it } from 'vitest';

import { decode } from '../decode.js';
import { flagReportRequest, flagReportResponse } from './flags.js';
import { healthResponse, pingResponse, usageResponse } from './health.js';
import { hintRequest, scanRequest, startGameRequest, submitRequest } from './game.js';
import { createRoomResponse } from './rooms.js';

describe('GET /ping (C7.1)', () => {
  it('answers exactly {"status":"alive"}', () => {
    expect(pingResponse.parse({ status: 'alive' })).toEqual({ status: 'alive' });
  });

  // The contract says "exactly": load balancers read this, and `ok` is not
  // `alive`.
  it.each([[{ status: 'ok' }], [{ status: 'ALIVE' }], [{}]])('refuses %j', (body) => {
    expect(pingResponse.safeParse(body).success).toBe(false);
  });
});

describe('GET /api/health (C7.2)', () => {
  const HEALTHY = {
    status: 'ok',
    version: '1.4.0',
    commit: 'a1b2c3d4e5f6a7b8c9d0',
    commitShort: 'a1b2c3d',
    model: 'gemini-3.1-flash-lite',
    llmConfigured: true,
  };

  it('carries every field of the contract, and only those', () => {
    expect(Object.keys(healthResponse.parse(HEALTHY)).sort()).toEqual([
      'commit',
      'commitShort',
      'llmConfigured',
      'model',
      'status',
      'version',
    ]);
  });

  // The CI probe reads `commit` and compares it to the pushed SHA. Locally
  // there is no commit, so an empty string is valid — but the key must exist,
  // or the probe reads `undefined` and waits for a match that cannot come.
  it('accepts an empty commit but not a missing one', () => {
    expect(
      healthResponse.safeParse({ ...HEALTHY, commit: '', commitShort: '' }).success,
    ).toBe(true);
    const { commit: _commit, ...withoutCommit } = HEALTHY;
    expect(healthResponse.safeParse(withoutCommit).success).toBe(false);
  });

  it('keeps commitShort to seven characters', () => {
    expect(
      healthResponse.safeParse({ ...HEALTHY, commitShort: 'a1b2c3d4' }).success,
    ).toBe(false);
  });

  // There is no field for the API key, so there is nothing to leak: a key
  // spread into the response disappears rather than being served.
  //
  // The marker deliberately does not imitate a real key format. A convincing
  // fake would trip the repository's own secret scanner and gitleaks, and a
  // test that has to be exempted from a rule is a test that weakens it.
  const KEY = 'APIKEYMARKER-never-serve-this';

  it('cannot carry the API key', () => {
    const parsed = healthResponse.parse({ ...HEALTHY, googleApiKey: KEY, apiKey: KEY });
    expect(JSON.stringify(parsed)).not.toContain('APIKEYMARKER');
  });

  it('says whether generation can work as a boolean, not a truthy string', () => {
    expect(healthResponse.safeParse({ ...HEALTHY, llmConfigured: 'yes' }).success).toBe(
      false,
    );
  });
});

describe('GET /api/usage (C4.6)', () => {
  const REPORT = {
    usage: {
      gamesGenerated: 12,
      gamesServedFromCache: 30,
      byKind: {
        falsification: {
          calls: 12,
          failures: 1,
          promptChars: 40_000,
          outputChars: 9_000,
          inputTokens: 11_000,
          outputTokens: 2_400,
        },
      },
      totals: { llmCalls: 24, inputTokens: 22_000, outputTokens: 4_800 },
      perGeneratedGame: { llmCalls: 2, inputTokens: 1833.3, outputTokens: 400 },
      cacheHitRate: 0.714,
    },
    cache: {
      categories: 40,
      articles: 96,
      maxCategories: 200,
      variantsPerCategory: 3,
      ttlSeconds: 21_600,
    },
  };

  it('exposes the two figures the contract names', () => {
    const parsed = usageResponse.parse(REPORT);
    expect(parsed.usage.cacheHitRate).toBe(0.714);
    expect(parsed.usage.perGeneratedGame.llmCalls).toBe(2);
  });

  it('refuses a hit rate outside [0,1]', () => {
    expect(
      usageResponse.safeParse({
        ...REPORT,
        usage: { ...REPORT.usage, cacheHitRate: 1.2 },
      }).success,
    ).toBe(false);
  });
});

describe('POST /api/multiplayer/create (C5.6)', () => {
  it('returns a six-character code', () => {
    expect(createRoomResponse.parse({ roomCode: 'A1B2C3' })).toEqual({
      roomCode: 'A1B2C3',
    });
  });

  it('refuses a lower-case code', () => {
    expect(createRoomResponse.safeParse({ roomCode: 'a1b2c3' }).success).toBe(false);
  });
});

describe('the solo requests', () => {
  const SESSION = 'aBcDeFgHiJkLmNoP';

  it('defaults a hint to level 1', () => {
    expect(hintRequest.parse({ sessionId: SESSION, falseInfoNumber: 2 })).toEqual({
      sessionId: SESSION,
      falseInfoNumber: 2,
      level: 1,
    });
  });

  it('defaults an empty scan to no marks', () => {
    expect(scanRequest.parse({ sessionId: SESSION })).toEqual({
      sessionId: SESSION,
      marked: [],
    });
  });

  it('refuses a session id that could not be one', () => {
    const result = decode(submitRequest, { sessionId: '../../etc', marked: [1] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]).toMatch(/^sessionId: /);
  });

  // C1.3 — the same guarantee as over the socket: a client-declared penalty is
  // not ignored, it cannot be expressed.
  it('drops a self-declared penalty from a submission', () => {
    expect(
      submitRequest.parse({
        sessionId: SESSION,
        marked: [1],
        hintPenalty: 0,
        scoreStolen: -100_000,
      }),
    ).toEqual({ sessionId: SESSION, marked: [1] });
  });

  it('requires a topic to start on', () => {
    expect(startGameRequest.safeParse({}).success).toBe(false);
    expect(startGameRequest.parse({ topic: 'Paris' })).toEqual({ topic: 'Paris' });
  });
});

describe('POST /api/flag-report', () => {
  const MINIMAL = {
    articleTitle: 'Paris',
    flaggedClaim: 'Paris compte deux arrondissements.',
    proposedCorrection: 'Paris compte vingt arrondissements.',
  };

  it('accepts a report with only the three fields that matter', () => {
    expect(flagReportRequest.parse(MINIMAL)).toEqual({
      ...MINIMAL,
      articleUrl: '',
      quickNote: '',
      explanation: '',
      sources: [],
      playerId: 'anonymous',
      roomCode: '',
    });
  });

  it('refuses a report with nothing to correct', () => {
    expect(
      flagReportRequest.safeParse({ ...MINIMAL, proposedCorrection: '  ' }).success,
    ).toBe(false);
  });

  it('refuses a source that is not a URL', () => {
    expect(
      flagReportRequest.safeParse({ ...MINIMAL, sources: ['trust me'] }).success,
    ).toBe(false);
  });

  // The verdict comes straight out of a language model through `json.loads`
  // today: nothing checks it answered with one of the values its own prompt
  // lists, so a sixth value would reach the client unnoticed.
  it.each([['likely_valid'], ['uncertain'], ['unsupported']])(
    'accepts the verdict %s',
    (verdict) => {
      expect(
        flagReportResponse.safeParse({
          id: 'flag_1',
          status: 'ai_reviewed',
          verification: {
            verdict,
            confidence: 80,
            reasoning: 'Le contexte confirme la correction.',
            sourcesFound: [],
            recommendation: 'approve_for_review',
          },
        }).success,
      ).toBe(true);
    },
  );

  it.each([['probably_true'], ['']])('refuses the verdict %s', (verdict) => {
    expect(
      flagReportResponse.safeParse({
        id: 'flag_1',
        status: 'ai_reviewed',
        verification: {
          verdict,
          confidence: 80,
          reasoning: 'x',
          sourcesFound: [],
          recommendation: 'reject',
        },
      }).success,
    ).toBe(false);
  });

  it('refuses a confidence outside 0-100', () => {
    expect(
      flagReportResponse.safeParse({
        id: 'flag_1',
        status: 'ai_reviewed',
        verification: {
          verdict: 'uncertain',
          confidence: 120,
          reasoning: 'x',
          sourcesFound: [],
          recommendation: 'reject',
        },
      }).success,
    ).toBe(false);
  });
});
