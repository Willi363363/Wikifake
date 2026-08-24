// 3.5's criterion, on real fixtures with a mocked model: each position
// designates a paragraph that differs from the original, **and only those**; two
// concurrent generations exchange no state.
//
// "And only those" is the half that matters. A generator that falsifies four
// paragraphs and reports three is a player marked wrong for missing something
// they could not have known about; one that reports a paragraph it did not touch
// is the historical bug — the player graded on text nobody changed.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isWellFormedSolution, solutionIssues } from '@wikifake/domain';
import { serverMessages } from '@wikifake/protocol';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';

import {
  generateArticle,
  MIN_ARTICLE_PARAGRAPHS,
  type GenerateOptions,
} from './generate.js';

import { collectParagraphs } from './paragraphs.js';

/**
 * The round alone.
 *
 * Since step 3.7 `generateArticle` returns what happened *and* every model call
 * it made, because a failed generation still has to be billed. The tests about
 * the round read it through here; the ones about the cost call it directly.
 */
const roundOf = async (options: GenerateOptions) =>
  (await generateArticle(options)).result;

const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));
const CHAT = readFileSync(`${FIXTURES}chat.html`, 'utf8');
const CHOCOLAT = readFileSync(`${FIXTURES}chocolat.html`, 'utf8');

/**
 * A model that falsifies whatever it is offered, by prefixing the text.
 *
 * Prefixing rather than replacing keeps the paragraphs distinguishable, so a
 * position pointing at the wrong one is visible rather than plausible.
 */
function falsifier(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async (options) => {
      const sent = JSON.stringify(options.prompt);
      const offered = [...sent.matchAll(/paragraph_index\\?":\s*(\d+)/g)].map((match) =>
        Number(match[1]),
      );
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              falsifications: offered.map((index) => ({
                paragraphIndex: index,
                swappedText: `FAUX-${String(index)} texte falsifié pour ce paragraphe.`,
                explanation: `La vérité sur ${String(index)}.`,
                hint: `Vérifiez le paragraphe ${String(index)}.`,
              })),
            }),
          },
        ],
        finishReason: { unified: 'stop' as const, raw: undefined },
        usage: {
          inputTokens: {
            total: 5000,
            noCache: 5000,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 900, text: 900, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
}

const BASE = { topic: 'Chat', sourceUrl: 'https://fr.wikipedia.org/wiki/Chat', seed: 7 };

describe('C3.1 — positions designate exactly what changed', () => {
  it.each([
    ['chat.html', CHAT],
    ['chocolat.html', CHOCOLAT],
  ])(
    '%s: every position differs from the original, and only those',
    async (_name, html) => {
      const before = collectParagraphs(html).paragraphs;
      const result = await roundOf({ ...BASE, html, model: falsifier() });

      expect(result.ok, result.ok ? '' : result.detail).toBe(true);
      if (!result.ok) return;

      const after = result.value.article.paragraphs;
      expect(after).toHaveLength(before.length);

      // Which paragraphs actually moved, read off the article rather than trusted.
      const changed = before
        .map((text, index) => (text === after[index] ? null : index + 1))
        .filter((index): index is number => index !== null);

      const reported = result.value.solution.map((position) => position.paragraphIndex);

      expect(reported).toEqual(changed);
    },
  );

  it.each([
    ['chat.html', CHAT],
    ['chocolat.html', CHOCOLAT],
  ])('%s: the solution satisfies C3.3', async (_name, html) => {
    const result = await roundOf({ ...BASE, html, model: falsifier() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Checked with the rules that will grade it, not with a second opinion
    // written here: `domain` owns what a well-formed solution is.
    expect(solutionIssues(result.value.solution)).toEqual([]);
    expect(isWellFormedSolution(result.value.solution)).toBe(true);
  });

  it('numbers the fakes in the order a player meets them', async () => {
    const result = await roundOf({ ...BASE, html: CHAT, model: falsifier() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const numbers = result.value.solution.map((position) => position.falseInfoNumber);
    const indices = result.value.solution.map((position) => position.paragraphIndex);

    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(numbers).toEqual(numbers.map((_value, at) => at + 1));
  });

  it('reports the falsified text, not the original', async () => {
    const result = await roundOf({ ...BASE, html: CHAT, model: falsifier() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const position of result.value.solution) {
      expect(position.falseStatement).toContain('FAUX-');
      expect(result.value.article.paragraphs[position.paragraphIndex - 1]).toBe(
        position.falseStatement,
      );
    }
  });

  // The nastiest shape of the historical bug, and the one the assertion above
  // cannot see: the right *set* of paragraphs is falsified, but the explanation
  // and the hint belong to a different one. A player then reads a hint about
  // paragraph 5 for the fake sitting in paragraph 2.
  //
  // `falseStatement` is read back off the article, so it agrees with the article
  // by construction and proves nothing here. The mock stamps the index it was
  // given into all three fields, so this checks they still agree with each other.
  it.each([
    ['chat.html', CHAT],
    ['chocolat.html', CHOCOLAT],
  ])(
    '%s: the explanation and the hint describe the paragraph they point at',
    async (_name, html) => {
      const result = await roundOf({ ...BASE, html, model: falsifier() });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      for (const position of result.value.solution) {
        const collectedIndex = position.paragraphIndex - 1;
        expect(position.falseStatement, 'text').toContain(
          `FAUX-${String(collectedIndex)} `,
        );
        expect(position.explanation, 'explanation').toContain(
          `sur ${String(collectedIndex)}.`,
        );
        expect(position.hint, 'hint').toContain(`paragraphe ${String(collectedIndex)}.`);
      }
    },
  );

  it('counts the fakes it actually made', async () => {
    const result = await roundOf({ ...BASE, html: CHAT, model: falsifier() });
    expect(result.ok && result.value.article.totalFakes).toBe(
      result.ok ? result.value.solution.length : -1,
    );
  });

  it('produces an article the protocol accepts, with no truth in it', async () => {
    const result = await roundOf({ ...BASE, html: CHAT, model: falsifier() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const message = {
      type: 'game_start' as const,
      ...result.value.article,
      players: [{ name: 'ada', colour: '#e63946' }],
      withItems: true,
      timeLimit: 300,
    };
    expect(serverMessages.gameStart.safeParse(message).success).toBe(true);

    // C1.1, at the end of the chain: the round-start payload carries no
    // explanation and no hint.
    const serialised = JSON.stringify(serverMessages.gameStart.parse(message));
    for (const position of result.value.solution) {
      expect(serialised).not.toContain(position.explanation);
      expect(serialised).not.toContain(position.hint);
    }
  });
});

describe('C3.6 — the generator is stateless', () => {
  it('two concurrent generations exchange nothing', async () => {
    const [first, second] = await Promise.all([
      roundOf({ ...BASE, html: CHAT, model: falsifier(), seed: 1 }),
      roundOf({
        ...BASE,
        topic: 'Chocolat',
        html: CHOCOLAT,
        model: falsifier(),
        seed: 2,
      }),
    ]);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.value.article.topic).toBe('Chat');
    expect(second.value.article.topic).toBe('Chocolat');
    // Neither article carries the other's paragraphs.
    expect(first.value.article.paragraphs[0]).not.toBe(
      second.value.article.paragraphs[0],
    );
  });

  it('the same seed picks the same paragraphs', async () => {
    const once = await roundOf({
      ...BASE,
      html: CHAT,
      model: falsifier(),
      seed: 42,
    });
    const twice = await roundOf({
      ...BASE,
      html: CHAT,
      model: falsifier(),
      seed: 42,
    });

    expect(once.ok && twice.ok).toBe(true);
    if (!once.ok || !twice.ok) return;
    expect(once.value.solution.map((p) => p.paragraphIndex)).toEqual(
      twice.value.solution.map((p) => p.paragraphIndex),
    );
  });

  // The draw is a rule of the game: the same article played twice must not hide
  // its fakes in the same places.
  it('a different seed picks different paragraphs', async () => {
    const picks = await Promise.all(
      [1, 2, 3, 4, 5].map(async (seed) => {
        const result = await roundOf({
          ...BASE,
          html: CHAT,
          model: falsifier(),
          seed,
        });
        return result.ok
          ? result.value.solution.map((p) => p.paragraphIndex).join(',')
          : '';
      }),
    );
    expect(new Set(picks).size).toBeGreaterThan(1);
  });

  it('does not mutate the HTML it was given', async () => {
    const html = CHAT;
    await roundOf({ ...BASE, html, model: falsifier() });
    expect(html).toBe(CHAT);
    expect(collectParagraphs(html).paragraphs[0]).toBe(
      collectParagraphs(CHAT).paragraphs[0],
    );
  });
});

describe('what the generator refuses', () => {
  it('an article with too few usable paragraphs', async () => {
    const html = `<div id="bodyContent"><p>${'a'.repeat(200)}</p></div>`;
    const result = await roundOf({ ...BASE, html, model: falsifier() });

    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? '' : result.detail).toContain('usable paragraphs');
    expect(MIN_ARTICLE_PARAGRAPHS).toBe(3);
  });

  it('an article whose paragraphs are all too short to falsify', async () => {
    const short = 'x'.repeat(60);
    const html = `<div id="bodyContent"><p>${short}</p><p>${short}b</p><p>${short}c</p></div>`;
    const result = await roundOf({ ...BASE, html, model: falsifier() });

    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? '' : result.detail).toContain('long enough');
  });

  // A position pointing at an untouched paragraph is the historical bug wearing
  // a different hat: the player marked wrong for not finding something that is
  // not there.
  it('a model that returns the paragraph unchanged', async () => {
    const before = collectParagraphs(CHAT).paragraphs;
    const echo = new MockLanguageModelV4({
      doGenerate: async (options) => {
        const sent = JSON.stringify(options.prompt);
        const offered = [...sent.matchAll(/paragraph_index\\?":\s*(\d+)/g)].map((m) =>
          Number(m[1]),
        );
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                falsifications: offered.map((index) => ({
                  paragraphIndex: index,
                  swappedText: before[index] ?? 'x',
                  explanation: 'rien',
                  hint: 'rien',
                })),
              }),
            },
          ],
          finishReason: { unified: 'stop' as const, raw: undefined },
          usage: {
            inputTokens: {
              total: 1,
              noCache: 1,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
          warnings: [],
        };
      },
    });

    const result = await roundOf({ ...BASE, html: CHAT, model: echo });
    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? '' : result.detail).toContain('changed nothing');
  });

  it('reports the call it made', async () => {
    const report = await generateArticle({ ...BASE, html: CHAT, model: falsifier() });

    expect(report.result.ok).toBe(true);
    expect(report.calls).toHaveLength(1);
    expect(report.calls[0]).toMatchObject({
      kind: 'falsification',
      inputTokens: 5000,
      outputTokens: 900,
      failed: false,
    });
  });

  // The whole reason 3.7 changed this signature: a generation that fails must
  // still hand back the call. C4.5 keeps it out of `perGeneratedGame`; nothing
  // says to throw the record away, and throwing it away is what makes the cost
  // of failure invisible today.
  it('reports the call even when the generation fails', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => {
        throw new Error('the provider is down');
      },
    });
    const report = await generateArticle({ ...BASE, html: CHAT, model });

    expect(report.result.ok).toBe(false);
    expect(report.calls).toHaveLength(1);
    expect(report.calls[0]).toMatchObject({ failed: true });
  });

  it('reports no call when it never reached the model', async () => {
    const report = await generateArticle({
      ...BASE,
      html: '<p>trop court</p>',
      model: falsifier(),
    });

    expect(report.result.ok).toBe(false);
    expect(report.calls).toEqual([]);
  });
});
