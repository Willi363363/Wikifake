// The whole chain: HTML in, a playable round out.
//
// C3.1 — `positions` designates exactly the paragraphs the model modified. This
// is the guarantee the phase exists for, and the reason the chain is one function
// rather than a pipeline a caller assembles: every step here works on the same
// collected article, so there is no seam where an index could be reinterpreted.
//
// C3.6 — stateless. Nothing is memoised, nothing is module-level, and two
// concurrent generations share nothing but the fixture they were handed.
import type { ArticleView, FalsifiedPosition } from '@wikifake/protocol';
import type { LanguageModel } from 'ai';

import {
  falsifiableCandidates,
  falsify,
  FALSIFICATIONS_PER_ARTICLE,
  type Candidate,
} from './falsify.js';
import { collectParagraphs, injectFalsifications } from './paragraphs.js';
import { failed, ok, type Result } from './result.js';

/** How many usable paragraphs an article needs to be worth playing, from `MIN_ARTICLE_PARAGRAPHS`. */
export const MIN_ARTICLE_PARAGRAPHS = 3;

export interface GenerateOptions {
  /** The rendered page, as MediaWiki served it. */
  readonly html: string;
  readonly topic: string;
  /** C6.1 — the source link, which travels with the article. */
  readonly sourceUrl: string;
  readonly model: LanguageModel;
  /**
   * Which paragraphs get falsified.
   *
   * The current code calls `random.sample`. Keeping the draw preserves a rule of
   * the game — the same article played twice should not hide its fakes in the
   * same places — and keeping it a parameter preserves a testable generator.
   */
  readonly seed: number;
  readonly falsificationCount?: number;
  readonly maxOutputTokens?: number;
}

export interface GeneratedArticle {
  /** C1.1 — what the round may show: the article and the count, nothing else. */
  readonly article: ArticleView;
  /** C1.2 — the solution, which travels separately and arrives at the end. */
  readonly solution: readonly FalsifiedPosition[];
  /** The page with the falsifications in it, for the reader view. */
  readonly html: string;
  readonly usage: {
    readonly inputTokens: number | null;
    readonly outputTokens: number | null;
  };
}

/**
 * A deterministic shuffle, seeded by the caller.
 *
 * mulberry32 — thirty characters of arithmetic, no dependency. The point is not
 * cryptographic quality; it is that the same seed picks the same paragraphs, so
 * a failing generation can be replayed.
 */
function shuffle<T>(items: readonly T[], seed: number): T[] {
  let state = seed >>> 0;
  const random = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };

  const shuffled = [...items];
  for (let at = shuffled.length - 1; at > 0; at -= 1) {
    const swap = Math.floor(random() * (at + 1));
    [shuffled[at], shuffled[swap]] = [shuffled[swap] as T, shuffled[at] as T];
  }
  return shuffled;
}

/** The paragraphs to offer the model, chosen by seed and returned in document order. */
function choose(
  candidates: readonly Candidate[],
  count: number,
  seed: number,
): readonly Candidate[] {
  return shuffle(candidates, seed)
    .slice(0, Math.min(count, candidates.length))
    .sort((a, b) => a.index - b.index);
}

/**
 * Fetches nothing, decides nothing about retries: takes HTML and returns a round.
 *
 * C3.3 — the positions come back 1-based, sorted by ascending paragraph index,
 * numbered sequentially from 1. The numbering is assigned **after** sorting, so
 * `falseInfoNumber` and `paragraphIndex` always agree on order — the hint for
 * fake 1 is about the first falsified paragraph a player meets.
 */
export async function generateArticle(
  options: GenerateOptions,
): Promise<Result<GeneratedArticle>> {
  const collected = collectParagraphs(options.html);

  if (collected.paragraphs.length < MIN_ARTICLE_PARAGRAPHS) {
    return failed(
      'unexpected_response',
      `only ${String(collected.paragraphs.length)} usable paragraphs`,
    );
  }

  const candidates = falsifiableCandidates(collected.paragraphs);
  if (candidates.length === 0) {
    return failed('unexpected_response', 'no paragraph is long enough to falsify');
  }

  const chosen = choose(
    candidates,
    options.falsificationCount ?? FALSIFICATIONS_PER_ARTICLE,
    options.seed,
  );

  const falsified = await falsify({
    model: options.model,
    topic: options.topic,
    candidates: chosen,
    ...(options.maxOutputTokens === undefined
      ? {}
      : { maxOutputTokens: options.maxOutputTokens }),
  });
  if (!falsified.ok) return falsified;

  // C3.1 — a falsification that does not change its paragraph is not one. The
  // model sometimes returns the original text unchanged, and a position pointing
  // at an untouched paragraph is the historical bug wearing a different hat: the
  // player would be marked wrong for not finding something that is not there.
  const effective = falsified.value.falsifications.filter(
    (item) =>
      item.swappedText.trim() !== collected.paragraphs[item.paragraphIndex]?.trim(),
  );
  if (effective.length === 0) {
    return failed('unexpected_response', 'the model changed nothing');
  }

  const replacements = new Map(
    effective.map((item) => [item.paragraphIndex, item.swappedText]),
  );
  const injected = injectFalsifications(collected, replacements);

  // Sorted first, numbered second: the two orders cannot disagree.
  const ordered = [...effective].sort((a, b) => a.paragraphIndex - b.paragraphIndex);
  const solution: FalsifiedPosition[] = ordered.map((item, at) => ({
    // C3.3 — 1-based in the client contract.
    paragraphIndex: item.paragraphIndex + 1,
    falseInfoNumber: at + 1,
    falseStatement: injected.paragraphs[item.paragraphIndex] ?? item.swappedText,
    explanation: item.explanation,
    hint: item.hint,
  }));

  return ok({
    article: {
      topic: options.topic,
      paragraphs: [...injected.paragraphs],
      totalFakes: solution.length,
      wikipediaUrl: options.sourceUrl,
    },
    solution,
    html: injected.html,
    usage: falsified.value.usage,
  });
}
