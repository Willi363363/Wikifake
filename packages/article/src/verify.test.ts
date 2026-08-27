// D12 and D13, closed together.
//
// D12 — `flag_verifier.py` calls the model and records nothing, so the cost of
// checking a player's report is invisible and `/api/usage` under-reports the
// spend by however many reports came in.
//
// D13 — it never sets the library's language or user agent either. On a freshly
// restarted process, before any game has been generated, a report about a French
// article is fact-checked against the **English** Wikipedia. Here both are
// parameters and the type will not let a caller omit them.
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';

import { verifyFlag, type VerifyOptions } from './verify.js';
import type { WikiRequest, WikiTransport } from './mediawiki.js';

const FR: WikiRequest = { language: 'fr', userAgent: 'WikiFake/test (suite)' };

const PARAGRAPH =
  'Paris est la capitale de la France et compte vingt arrondissements administratifs disposés en spirale depuis le centre.';
const SECOND =
  'La tour Eiffel a été achevée en 1889 pour l’Exposition universelle qui se tenait cette année-là.';

const PAGE = {
  parse: {
    title: 'Paris',
    revid: 123,
    text: `<div id="bodyContent"><p>${PARAGRAPH}</p><p>${SECOND}</p></div>`,
  },
};
const MISSING = { error: { code: 'missingtitle' } };
const SEARCH = { query: { search: [{ title: 'Paris' }] } };

/** A transport that records where it went and answers with what it was given. */
function recorder(answers: readonly unknown[]) {
  const urls: string[] = [];
  let at = 0;

  const fetch: typeof globalThis.fetch = (input) => {
    urls.push(String(input));
    const body = answers[Math.min(at, answers.length - 1)];
    at += 1;
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };

  return { transport: { fetch } satisfies WikiTransport, urls };
}

const VERDICT = {
  verdict: 'likely_valid',
  confidence: 82,
  reasoning: 'Le contexte Wikipedia confirme la correction proposée par le joueur.',
  sourcesFound: ['vingt arrondissements'],
  recommendation: 'approve_for_review',
};

/** A model that answers `body`, and remembers what it was asked. */
function answering(body: unknown) {
  const prompts: string[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: (options) => {
      prompts.push(JSON.stringify(options.prompt));
      return Promise.resolve({
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
      });
    },
  });
  return { model, prompts };
}

/** A model that refuses. */
const refuser = new MockLanguageModelV4({
  doGenerate: () => Promise.reject(new Error('the model is unreachable')),
});

const REPORT = {
  articleTitle: 'Paris',
  flaggedClaim: 'Paris compte deux arrondissements.',
  proposedCorrection: 'Paris compte vingt arrondissements.',
  explanation: 'Le découpage date de 1860.',
  sources: ['https://fr.wikipedia.org/wiki/Arrondissements_de_Paris'],
  wiki: FR,
} satisfies Omit<VerifyOptions, 'model' | 'transport'>;

describe('D13 — the checker asks the Wikipedia it was told to', () => {
  it('sends every call to the language it was given', async () => {
    const { transport, urls } = recorder([PAGE]);
    const { model } = answering(VERDICT);

    await verifyFlag({ ...REPORT, model, transport });

    expect(urls).not.toHaveLength(0);
    for (const url of urls) expect(new URL(url).host).toBe('fr.wikipedia.org');
  });

  it('takes a different language on the very next call, with no leakage', async () => {
    const { transport, urls } = recorder([PAGE]);
    const { model } = answering(VERDICT);

    await verifyFlag({ ...REPORT, model, transport });
    await verifyFlag({
      ...REPORT,
      wiki: { language: 'en', userAgent: 'WikiFake/test (suite)' },
      model,
      transport,
    });

    expect(new URL(urls[0] as string).host).toBe('fr.wikipedia.org');
    expect(new URL(urls.at(-1) as string).host).toBe('en.wikipedia.org');
  });
});

describe('the reference material it puts in front of the model', () => {
  it('is the article’s prose, not its markup', async () => {
    const { transport } = recorder([PAGE]);
    const { model, prompts } = answering(VERDICT);

    await verifyFlag({ ...REPORT, model, transport });

    const asked = prompts.join(' ');
    expect(asked).toContain('vingt arrondissements');
    expect(asked).not.toContain('bodyContent');
  });

  // The fallback `flag_verifier.py` already has, made explicit: the exact title
  // first, then a search. `fetchRenderedPage` does not auto-suggest, so the
  // second lookup is a search we asked for rather than a near match the library
  // picked silently.
  it('searches when the exact title is not a page', async () => {
    const { transport, urls } = recorder([MISSING, SEARCH, PAGE]);
    const { model, prompts } = answering(VERDICT);

    const report = await verifyFlag({ ...REPORT, model, transport });

    expect(urls).toHaveLength(3);
    expect(report.contextFound).toBe(true);
    expect(prompts.join(' ')).toContain('vingt arrondissements');
  });

  // A report has to be recorded whatever Wikipedia did. Losing it because a
  // third party was unreachable loses the only signal the game has about the
  // quality of its own articles.
  it('asks the model anyway when Wikipedia says nothing', async () => {
    const { transport } = recorder([MISSING, { query: { search: [] } }]);
    const { model, prompts } = answering(VERDICT);

    const report = await verifyFlag({ ...REPORT, model, transport });

    expect(report.contextFound).toBe(false);
    expect(report.verification.verdict).toBe('likely_valid');
    expect(prompts.join(' ')).toContain('Non disponible');
  });
});

describe('D12 — the call is recorded, whatever it did', () => {
  it('records a successful check with what it cost', async () => {
    const { transport } = recorder([PAGE]);
    const { model } = answering(VERDICT);

    const report = await verifyFlag({ ...REPORT, model, transport });

    expect(report.call).toMatchObject({
      kind: 'flag_verification',
      failed: false,
      inputTokens: 400,
      outputTokens: 60,
    });
    expect(report.call?.promptChars).toBeGreaterThan(0);
  });

  it('records a failed check too, and still returns a verdict', async () => {
    const { transport } = recorder([PAGE]);

    const report = await verifyFlag({ ...REPORT, model: refuser, transport });

    expect(report.call).toMatchObject({
      kind: 'flag_verification',
      failed: true,
      inputTokens: null,
      outputTokens: null,
    });
    // The prompt was sent and billed, so its size is known and kept: a failure
    // whose cost is recorded as zero is a failure that looks free.
    expect(report.call?.promptChars).toBeGreaterThan(0);
    expect(report.verification).toMatchObject({
      verdict: 'uncertain',
      confidence: 0,
      recommendation: 'needs_more_info',
    });
  });
});

describe('the verdict is validated, not parsed', () => {
  // `verdict` and `recommendation` are free strings today: they come out of a
  // model through `json.loads`, so nothing checks the model answered with one of
  // the values its own prompt lists. A sixth value flows to the client unnoticed.
  it('refuses a verdict outside the union, and says it could not check', async () => {
    const { transport } = recorder([PAGE]);
    const { model } = answering({ ...VERDICT, verdict: 'definitely_true' });

    const report = await verifyFlag({ ...REPORT, model, transport });

    expect(report.verification.verdict).toBe('uncertain');
    expect(report.call?.failed).toBe(true);
  });

  it('refuses a confidence outside 0–100', async () => {
    const { transport } = recorder([PAGE]);
    const { model } = answering({ ...VERDICT, confidence: 900 });

    expect(
      (await verifyFlag({ ...REPORT, model, transport })).verification.confidence,
    ).toBe(0);
  });

  it('keeps a verdict the union does accept', async () => {
    const { transport } = recorder([PAGE]);
    const { model } = answering({
      ...VERDICT,
      verdict: 'unsupported',
      recommendation: 'reject',
    });

    const report = await verifyFlag({ ...REPORT, model, transport });
    expect(report.verification).toMatchObject({
      verdict: 'unsupported',
      recommendation: 'reject',
      confidence: 82,
    });
  });
});
