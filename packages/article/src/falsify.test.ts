// 3.4's criteria: a malformed model answer is rejected by the schema, and a
// paragraph longer than 1000 characters reaches the model whole.
//
// The model is mocked, so these are deterministic. What is being tested is not
// the model's judgement — that cannot be unit tested — but that the code around
// it believes only what the schema accepts, and hands over the text it was given.
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';

import {
  falsifiableCandidates,
  falsify,
  FALSIFICATIONS_PER_ARTICLE,
  MIN_FALSIFIABLE_CHARS,
  type FalsifyOptions,
} from './falsify.js';

/**
 * The answer alone.
 *
 * Since step 3.7 `falsify` returns what happened *and* what it cost, because a
 * failed call still has to be billed. Most of these tests are about the answer,
 * so they read it through here; the ones about the cost call `falsify` directly.
 */
const answerOf = async (options: FalsifyOptions) => (await falsify(options)).result;

/** Answers with whatever text it is given, and records the prompt it received. */
function modelAnswering(text: string) {
  const prompts: string[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      prompts.push(JSON.stringify(options.prompt));
      return {
        content: [{ type: 'text' as const, text }],
        finishReason: { unified: 'stop' as const, raw: undefined },
        usage: {
          inputTokens: {
            total: 1200,
            noCache: 1200,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 340, text: 340, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  return { model, prompts };
}

function answer(items: readonly Record<string, unknown>[]): string {
  return JSON.stringify({ falsifications: items });
}

const CANDIDATE = {
  index: 2,
  text: 'Un paragraphe assez long pour être falsifié, largement au-dessus du plancher de cent caractères imposé par le contrat.',
};

const GOOD = {
  paragraphIndex: 2,
  swappedText: 'Un paragraphe modifié.',
  explanation: 'La vérité.',
  hint: 'Vérifiez la date.',
};

describe('which paragraphs are offered', () => {
  it('keeps the collected index even after dropping the short ones', () => {
    const paragraphs = ['court', 'x'.repeat(MIN_FALSIFIABLE_CHARS), 'y'.repeat(200)];
    expect(falsifiableCandidates(paragraphs).map((candidate) => candidate.index)).toEqual(
      [1, 2],
    );
  });

  it('drops a paragraph under the floor, keeps one exactly on it', () => {
    expect(falsifiableCandidates(['a'.repeat(MIN_FALSIFIABLE_CHARS - 1)])).toEqual([]);
    expect(falsifiableCandidates(['a'.repeat(MIN_FALSIFIABLE_CHARS)])).toHaveLength(1);
  });

  it('measures the trimmed text, as the current filter does', () => {
    expect(
      falsifiableCandidates([`   ${'a'.repeat(MIN_FALSIFIABLE_CHARS - 1)}   `]),
    ).toEqual([]);
  });

  it('keeps the constants the current code holds twice', () => {
    // D8: `MIN_FALSIFIABLE_CHARS` in settings and `MIN_PARAGRAPH_LENGTH = 100`
    // hard-coded in `misinformation.py`. One constant here.
    expect(MIN_FALSIFIABLE_CHARS).toBe(100);
    expect(FALSIFICATIONS_PER_ARTICLE).toBe(4);
  });
});

describe('3.4 — a paragraph is never truncated on the way to the model', () => {
  // The bug: the current code sends `text[:1000]`, so the model rewrites an
  // ending it never saw while the player is served the paragraph in full — a
  // paragraph whose second half contradicts its first.
  it('sends a 2000-character paragraph whole', async () => {
    const long = `Début. ${'mot '.repeat(480)}Fin distinctive du paragraphe.`;
    expect(long.length).toBeGreaterThan(1_000);

    const { model, prompts } = modelAnswering(
      answer([
        { ...GOOD, paragraphIndex: 0, swappedText: long.replace('Début', 'Debut faux') },
      ]),
    );

    const result = await answerOf({
      model,
      topic: 'Paris',
      candidates: [{ index: 0, text: long }],
    });

    expect(result.ok).toBe(true);
    // The whole paragraph is in the prompt, tail included.
    expect(prompts[0]).toContain('Fin distinctive du paragraphe.');
    expect(JSON.parse(prompts[0] as string)).toBeDefined();
  });

  it('comes back whole, with no 1000-character cliff', async () => {
    const long = 'a'.repeat(1_500);
    const falsified = `${'b'.repeat(1_499)}!`;
    const { model } = modelAnswering(
      answer([{ ...GOOD, paragraphIndex: 0, swappedText: falsified }]),
    );

    const result = await answerOf({
      model,
      topic: 'Paris',
      candidates: [{ index: 0, text: long }],
    });

    expect(result.ok && result.value.falsifications[0]?.swappedText).toHaveLength(1_500);
  });
});

describe('3.4 — the schema is the only judge', () => {
  it('accepts a well-formed answer', async () => {
    const { model } = modelAnswering(answer([GOOD]));
    const result = await answerOf({ model, topic: 'Paris', candidates: [CANDIDATE] });

    expect(result.ok && result.value.falsifications).toEqual([GOOD]);
  });

  // Each of these used to be handled by a heuristic. Now they are one path.
  it.each([
    ['prose around the JSON', 'Voici le tableau : {"falsifications": []} — voilà.'],
    ['a Markdown fence', '```json\n{"falsifications":[]}\n```'],
    ['a bare array', '[{"paragraphIndex":2}]'],
    ['not JSON at all', 'Je ne peux pas faire cela.'],
    ['an empty answer', ''],
    ['an envelope with the wrong key', '{"results":[]}'],
  ])('rejects %s', async (_name, text) => {
    const { model } = modelAnswering(text);
    const result = await answerOf({ model, topic: 'Paris', candidates: [CANDIDATE] });
    expect(result.ok).toBe(false);
  });

  it.each([
    ['a missing hint', { paragraphIndex: 2, swappedText: 'x', explanation: 'y' }],
    ['an empty swappedText', { ...GOOD, swappedText: '' }],
    ['a string index', { ...GOOD, paragraphIndex: '2' }],
    ['a fractional index', { ...GOOD, paragraphIndex: 2.5 }],
    ['a negative index', { ...GOOD, paragraphIndex: -1 }],
  ])('rejects %s', async (_name, item) => {
    const { model } = modelAnswering(answer([item]));
    const result = await answerOf({ model, topic: 'Paris', candidates: [CANDIDATE] });
    expect(result.ok).toBe(false);
  });
});

describe('3.4 — an index the model was not given', () => {
  // The current code falls back to position when the indices do not match, which
  // turns "the model renumbered things" into "the player is graded on a
  // paragraph nobody touched". Dropped instead.
  it('drops a falsification quoting an index that was never offered', async () => {
    const { model } = modelAnswering(answer([GOOD, { ...GOOD, paragraphIndex: 99 }]));
    const result = await answerOf({ model, topic: 'Paris', candidates: [CANDIDATE] });

    expect(
      result.ok && result.value.falsifications.map((item) => item.paragraphIndex),
    ).toEqual([2]);
  });

  it('fails when nothing it returned was offered', async () => {
    const { model } = modelAnswering(answer([{ ...GOOD, paragraphIndex: 99 }]));
    const result = await answerOf({ model, topic: 'Paris', candidates: [CANDIDATE] });

    expect(result).toMatchObject({ ok: false, reason: 'unexpected_response' });
  });

  // C3.3 forbids two falsifications on one paragraph, and the database refuses
  // to store them. Collapsing here is what keeps that from becoming an error.
  it('keeps one falsification per paragraph', async () => {
    const { model } = modelAnswering(
      answer([GOOD, { ...GOOD, swappedText: 'Une autre version.' }]),
    );
    const result = await answerOf({ model, topic: 'Paris', candidates: [CANDIDATE] });

    expect(result.ok && result.value.falsifications).toHaveLength(1);
  });

  it('returns them sorted by paragraph index', async () => {
    const candidates = [CANDIDATE, { index: 0, text: 'z'.repeat(150) }];
    const { model } = modelAnswering(
      answer([GOOD, { ...GOOD, paragraphIndex: 0, swappedText: 'Premier.' }]),
    );
    const result = await answerOf({ model, topic: 'Paris', candidates });

    expect(
      result.ok && result.value.falsifications.map((item) => item.paragraphIndex),
    ).toEqual([0, 2]);
  });
});

describe('3.4 — the prompt', () => {
  it('carries the topic and the original text, verbatim', async () => {
    const { model, prompts } = modelAnswering(answer([GOOD]));
    await answerOf({ model, topic: 'Chat domestique', candidates: [CANDIDATE] });

    const sent = prompts[0] as string;
    expect(sent).toContain('Chat domestique');
    expect(sent).toContain('plancher de cent caract');
    // The wording is the one in use today, not a rewrite: this phase's pitfall
    // is not to mix a stack change with a behaviour change.
    expect(sent).toContain('expert en création de désinformation crédible');
    expect(sent).toContain('paragraph_index');
  });

  it('refuses to ask when no paragraph is long enough', async () => {
    const { model, prompts } = modelAnswering(answer([GOOD]));
    const result = await answerOf({ model, topic: 'Paris', candidates: [] });

    expect(result).toMatchObject({ ok: false, reason: 'unexpected_response' });
    expect(prompts).toEqual([]);
  });
});

describe('3.7 — what the call cost', () => {
  it('records the tokens the provider gave', async () => {
    const { model } = modelAnswering(answer([GOOD]));
    const report = await falsify({ model, topic: 'Paris', candidates: [CANDIDATE] });

    expect(report.result.ok).toBe(true);
    expect(report.call).toMatchObject({
      kind: 'falsification',
      inputTokens: 1200,
      outputTokens: 340,
      failed: false,
    });
  });

  it('counts the characters it sent, prompt and system together', async () => {
    const { model } = modelAnswering(answer([GOOD]));
    const report = await falsify({ model, topic: 'Paris', candidates: [CANDIDATE] });

    // The whole candidate reaches the model — 3.4's rule — so the count has to be
    // at least as long as the paragraph it sent. A zero here would mean the
    // proxy `usage.py` falls back on had silently stopped measuring.
    expect(report.call?.promptChars).toBeGreaterThan(CANDIDATE.text.length);
    expect(report.call?.outputChars).toBeGreaterThan(0);
  });

  // C4.5 read the way it is meant: a failure is *recorded* as a failure. It is
  // not counted as a generated game, which is a different thing, and losing the
  // record instead is how `/api/usage` under-reports the bill today.
  it('records a call that threw as a failure, not as nothing', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error('the provider is down');
      },
    });
    const report = await falsify({ model, topic: 'Paris', candidates: [CANDIDATE] });

    expect(report.result.ok).toBe(false);
    expect(report.call).toMatchObject({
      kind: 'falsification',
      failed: true,
      inputTokens: null,
      outputTokens: null,
      outputChars: 0,
    });
    // The prompt was sent and billed even though nothing came back.
    expect(report.call?.promptChars).toBeGreaterThan(0);
  });

  // A model that answers and is then disbelieved still spent the tokens. Marking
  // that call failed would hide real spend; what it must not produce is a game.
  it('records an unusable answer as a call that worked', async () => {
    const { model } = modelAnswering(
      JSON.stringify({ falsifications: [{ ...GOOD, paragraphIndex: 99 }] }),
    );
    const report = await falsify({ model, topic: 'Paris', candidates: [CANDIDATE] });

    expect(report.result.ok).toBe(false);
    expect(report.call).toMatchObject({ failed: false, inputTokens: 1200 });
  });

  it('records nothing when the model was never called', async () => {
    const { model } = modelAnswering(answer([GOOD]));
    const report = await falsify({ model, topic: 'Paris', candidates: [] });

    expect(report.result.ok).toBe(false);
    expect(report.call).toBeNull();
  });
});
