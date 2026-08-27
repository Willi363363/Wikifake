// 4.9's criterion: a report writes a complete `flag_report` row, and nothing is
// written to disk.
//
// `complaints.jsonl` lives on Render's ephemeral disk, so every redeployment
// throws away every report the game has ever received — and the reports are the
// only signal the game has about the quality of its own articles. Nothing reads
// the file either: there is no triage queue, because there is nothing to query.
import { selectFlagReport, selectFlagReportsFor } from '@wikifake/db';
import { MockLanguageModelV4 } from 'ai/test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { TestDatabase } from '@wikifake/db/testing';

import { createAuth } from '../../../src/auth/auth.js';
import { handleFlagReport } from '../../../src/game/flags.js';
import { handleUsage } from '../../../src/game/usage.js';
import {
  openWebTestDatabase,
  webTestDatabaseUrl,
} from '../../../src/testing/database.js';
import { cookieFrom } from '../../../src/testing/round.js';
import type { FlagsContext } from '../../../src/game/flags.js';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';

const PARAGRAPH =
  'Paris est la capitale de la France et compte vingt arrondissements administratifs disposés en spirale depuis le centre.';
const PAGE = {
  parse: {
    title: 'Paris',
    revid: 123,
    text: `<div id="bodyContent"><p>${PARAGRAPH}</p></div>`,
  },
};

const REPORT = {
  articleTitle: 'Paris',
  articleUrl: 'https://fr.wikipedia.org/wiki/Paris',
  flaggedClaim: 'Paris compte deux arrondissements.',
  proposedCorrection: 'Paris compte vingt arrondissements.',
  quickNote: 'Vu dans le premier paragraphe.',
  explanation: 'Le découpage actuel date de 1860.',
  sources: ['https://fr.wikipedia.org/wiki/Arrondissements_de_Paris'],
};

const VERDICT = {
  verdict: 'likely_valid',
  confidence: 82,
  reasoning: 'Le contexte Wikipedia confirme la correction proposée par le joueur.',
  sourcesFound: ['vingt arrondissements'],
  recommendation: 'approve_for_review',
};

function wikipedia(): FlagsContext['transport'] {
  return {
    fetch: () =>
      Promise.resolve(
        new Response(JSON.stringify(PAGE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
  };
}

function answering(body: unknown): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: () =>
      Promise.resolve({
        content: [{ type: 'text' as const, text: JSON.stringify(body) }],
        finishReason: { unified: 'stop' as const, raw: undefined },
        usage: {
          inputTokens: {
            total: 400,
            noCache: 400,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 60, text: 60, reasoning: undefined },
        },
        warnings: [],
      }),
  });
}

const refuser = new MockLanguageModelV4({
  doGenerate: () => Promise.reject(new Error('the model is unreachable')),
});

describe.skipIf(url === null)('4.9 — POST /api/flag-report', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openWebTestDatabase();
  });
  afterAll(async () => {
    await store.close();
  });
  beforeEach(async () => {
    await store.truncate();
  });

  const context = (model: MockLanguageModelV4 = answering(VERDICT)): FlagsContext => ({
    auth: createAuth({ db: store.db, secret: SECRET, baseURL: BASE }),
    db: store.db,
    model,
    wiki: { language: 'fr', userAgent: 'WikiFake/test (suite)' },
    transport: wikipedia(),
  });

  const send = (
    body: unknown,
    model?: MockLanguageModelV4,
    cookie?: string,
  ): Promise<Response> =>
    handleFlagReport(
      context(model),
      new Request(`${BASE}/api/flag-report`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(cookie === undefined ? {} : { cookie }),
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    );

  describe('the criterion — a complete row, and no file', () => {
    it('writes every field of the report and of the verdict', async () => {
      const response = await send(REPORT);
      expect(response.status).toBe(200);

      const { id } = (await response.json()) as { id: string };
      const [row] = await selectFlagReport(store.db, id);

      expect(row).toMatchObject({
        articleTitle: 'Paris',
        articleUrl: 'https://fr.wikipedia.org/wiki/Paris',
        flaggedClaim: 'Paris compte deux arrondissements.',
        proposedCorrection: 'Paris compte vingt arrondissements.',
        quickNote: 'Vu dans le premier paragraphe.',
        explanation: 'Le découpage actuel date de 1860.',
        sources: REPORT.sources,
        // The verdict beside the report: one whose assessment lives elsewhere is
        // one nobody can triage, which is what the JSONL file leaves them as.
        verdict: 'likely_valid',
        confidence: 82,
        reasoning: VERDICT.reasoning,
        sourcesFound: VERDICT.sourcesFound,
        recommendation: 'approve_for_review',
        status: 'pending_human_review',
      });
      expect(row?.createdAt).toBeInstanceOf(Date);
    });

    // "Nothing is written to disk", read as: nothing on this path can be.
    //
    // Checked on the source rather than by spying on `fs`, because a spy proves
    // it about one request and this proves it about every one. It is a guard
    // rather than a discovery — a "keep a backup copy" line added later is
    // exactly how the ephemeral disk would come back, and it would come back
    // silently.
    it('has no way to write to disk', () => {
      const root = fileURLToPath(new URL('../../../../../', import.meta.url));
      const onThePath = [
        'apps/web/src/game/flags.ts',
        'packages/article/src/verify.ts',
        'packages/db/src/queries/flags.ts',
      ];

      for (const file of onThePath) {
        const source = readFileSync(`${root}${file}`, 'utf8');
        expect(source, `${file} reaches for the filesystem`).not.toMatch(/from 'node:fs/);
        expect(source, `${file} reaches for the filesystem`).not.toContain('writeFile');
        expect(source, `${file} reaches for the filesystem`).not.toContain('appendFile');
      }
    });

    // What an ephemeral disk does not do: survive. A context built from scratch
    // reads back a report filed by a previous one.
    it('is still there for a handler built from scratch', async () => {
      const { id } = (await (await send(REPORT)).json()) as { id: string };

      const found = await selectFlagReportsFor(store.db, 'Paris', 'pending_human_review');
      expect(found.map((row) => row.id)).toEqual([id]);
    });
  });

  describe('what the verdict does to the report', () => {
    it.each([
      ['approve_for_review', 'pending_human_review'],
      ['reject', 'rejected_by_ai'],
      ['needs_more_info', 'ai_reviewed'],
    ])('%s puts it in %s', async (recommendation, status) => {
      const response = await send(REPORT, answering({ ...VERDICT, recommendation }));

      const body = (await response.json()) as { id: string; status: string };
      expect(body.status).toBe(status);
      expect((await selectFlagReport(store.db, body.id))[0]?.status).toBe(status);
    });

    // A report has to be kept whatever the model did. Losing it because a third
    // party was unreachable loses the only signal the game has about its own
    // articles.
    it('keeps the report when the check itself fails', async () => {
      const response = await send(REPORT, refuser);
      expect(response.status).toBe(200);

      const body = (await response.json()) as {
        id: string;
        verification: { verdict: string };
      };
      expect(body.verification.verdict).toBe('uncertain');

      const [row] = await selectFlagReport(store.db, body.id);
      expect(row?.status).toBe('ai_reviewed');
      expect(row?.flaggedClaim).toBe(REPORT.flaggedClaim);
    });
  });

  // D12 — `flag_verifier.py` records nothing, so `/api/usage` under-reports the
  // spend by however many reports came in.
  describe('D12 — the check is paid for visibly', () => {
    it('shows up in the spend, under its own kind', async () => {
      await send(REPORT);

      const usage = (await (await handleUsage({ db: store.db, cache: null })).json()) as {
        usage: { byKind: Record<string, { calls: number; inputTokens: number }> };
      };

      expect(usage.usage.byKind['flag_verification']).toMatchObject({
        calls: 1,
        inputTokens: 400,
        outputTokens: 60,
      });
      // No game was generated, so nothing is diluted: the check is a cost of its
      // own rather than part of the price of a round.
      expect(usage.usage.byKind['falsification']).toBeUndefined();
    });

    it('shows a failed check as a failure rather than as nothing', async () => {
      await send(REPORT, refuser);

      const usage = (await (await handleUsage({ db: store.db, cache: null })).json()) as {
        usage: { byKind: Record<string, { calls: number; failures: number }> };
      };

      expect(usage.usage.byKind['flag_verification']).toMatchObject({
        calls: 0,
        failures: 1,
      });
    });
  });

  describe('who filed it', () => {
    it('attributes it to the account that sent it', async () => {
      const instance = createAuth({ db: store.db, secret: SECRET, baseURL: BASE });
      const signedUp = await instance.handler(
        new Request(`${BASE}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Élise',
            email: 'elise@example.test',
            password: 'un-mot-de-passe-assez-long',
          }),
        }),
      );
      const account = (await signedUp.json()) as { user: { id: string } };

      const response = await handleFlagReport(
        { ...context(), auth: instance },
        new Request(`${BASE}/api/flag-report`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: cookieFrom(signedUp),
          },
          body: JSON.stringify(REPORT),
        }),
      );

      const { id } = (await response.json()) as { id: string };
      expect((await selectFlagReport(store.db, id))[0]?.reporterId).toBe(account.user.id);
    });

    // The contract's `playerId` was written for a client that had no accounts,
    // and is whatever the browser types. A report attributed to whoever claimed
    // to have filed it can be attributed to somebody else.
    it('ignores the reporter the payload claims to be', async () => {
      const { id } = (await (await send({ ...REPORT, playerId: 'Élise' })).json()) as {
        id: string;
      };

      expect((await selectFlagReport(store.db, id))[0]?.reporterId).toBeNull();
    });

    // A room plays many rounds, and the request names a room. A report filed
    // against the wrong round is worse than one filed against none.
    it('leaves the game unnamed rather than guessing at one', async () => {
      const { id } = (await (await send({ ...REPORT, roomCode: 'A1B2C3' })).json()) as {
        id: string;
      };

      expect((await selectFlagReport(store.db, id))[0]?.gameId).toBeNull();
    });
  });

  describe('the body', () => {
    it('takes a report with only what the form requires', async () => {
      const response = await send({
        articleTitle: 'Paris',
        flaggedClaim: 'Paris compte deux arrondissements.',
        proposedCorrection: 'Paris compte vingt arrondissements.',
      });
      expect(response.status).toBe(200);

      const { id } = (await response.json()) as { id: string };
      const [row] = await selectFlagReport(store.db, id);
      expect(row).toMatchObject({ articleUrl: '', quickNote: '', explanation: '' });
      expect(row?.sources).toEqual([]);
    });

    it('refuses one it cannot read', async () => {
      expect((await send('{ nope')).status).toBe(400);
      expect((await send({ ...REPORT, flaggedClaim: '' })).status).toBe(400);
      expect((await send({ ...REPORT, sources: ['not-a-url'] })).status).toBe(400);
    });
  });
});
