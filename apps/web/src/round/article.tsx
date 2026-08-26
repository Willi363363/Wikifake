'use client';

// The article, on the paper it is printed on.
//
// One paragraph is one token, and the paragraph number is what the player marks
// — 1-based, as the contract says (C3.3), so the number clicked is the number
// graded with no arithmetic in between to get wrong. The current game marks
// sub-paragraph spans and carries their falsification metadata in the client's
// own article model, which is the leak the negative assertions exist to catch;
// here the payload has no such field to leak, because `articleView` has none.
//
// `ParagraphToken` is step 6.4's, and it is the reason the central gesture of
// the game is reachable at all: a `<button>` with `aria-pressed`, focusable,
// answering Enter and Space. The current `<span onClick>` answers none of them.
import type { gameApi } from '@wikifake/protocol';
import { ParagraphToken, tokenStateFor } from '@wikifake/ui';

import { Attribution } from './attribution.js';

export interface ArticleCardProps {
  readonly article: gameApi.StartGameResponse | ArticleFacts;
  /** The paragraph numbers the player has marked, 1-based. */
  readonly marked: readonly number[];
  /**
   * C1.4 — paragraphs a **level-2** reveal has pointed at.
   *
   * Level 1 is a sentence, not a location. The current game highlights the
   * paragraph at level 1 as well, which hands over the answer at the nudge's
   * price.
   */
  readonly hinted: ReadonlySet<number>;
  /** True once the round is out of the player's hands. */
  readonly locked: boolean;
  onToggle(paragraph: number): void;
}

/** What this card needs of an article, and nothing more. */
export interface ArticleFacts {
  readonly topic: string;
  readonly paragraphs: readonly string[];
  readonly totalFakes: number;
  readonly wikipediaUrl: string;
}

export function ArticleCard({
  article,
  marked,
  hinted,
  locked,
  onToggle,
}: ArticleCardProps) {
  return (
    <article className="rounded-xl border border-line bg-surface px-5 py-6 shadow-md sm:px-10 sm:py-8">
      <header className="flex flex-wrap items-center gap-3 border-b border-line pb-3 font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
        <span>Source · Wikipedia</span>
        <span aria-hidden="true" className="h-3 w-px bg-line" />
        <span>Modified text</span>
      </header>

      <h1 className="mt-6 text-3xl text-ink">{article.topic}</h1>

      {/* The body. `space-y` rather than a gap on a flex column, so a paragraph
          that wraps keeps the rhythm of prose. */}
      <div className="mt-5 space-y-2 text-[15px] leading-relaxed">
        {article.paragraphs.map((text, at) => {
          const paragraph = at + 1;
          return (
            <ParagraphToken
              key={paragraph}
              state={tokenStateFor({
                marked: marked.includes(paragraph),
                hinted: hinted.has(paragraph),
              })}
              disabled={locked}
              onClick={() => {
                onToggle(paragraph);
              }}
            >
              {text}
            </ParagraphToken>
          );
        })}
      </div>

      <Attribution topic={article.topic} sourceUrl={article.wikipediaUrl} />
    </article>
  );
}
