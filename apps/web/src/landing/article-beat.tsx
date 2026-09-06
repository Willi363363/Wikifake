// Step C.4 — beats 2 and 3, which are the same paragraph twice.
//
// One component rendered twice, rather than two sections that look alike. The
// collision of beat 3 only reads if the false paragraph lands on **exactly the
// rectangle** the true one occupied, and two hand-written sections drift apart
// the first time somebody adds a line to one of them. Here they cannot: the
// three rows are this component's, and the only thing that differs between the
// two beats is what goes in them.
//
// The third row is the reason it is a component at all. Beat 3 has a sentence
// under the article and beat 2 has none — so beat 2 renders that row **empty on
// purpose**, holding the space that keeps the two sheets aligned. That is a
// piece of markup whose whole job is layout, and it is worth the line it costs.
import { cn, ReadingSheet } from '@wikifake/ui';
import type { ReactNode } from 'react';

export interface ArticleBeatProps {
  /** The heading's id, which the section is labelled by. */
  readonly headingId: string;
  readonly title: string;
  readonly body: string;
  /** The article extract. French, in every locale — it is `fr.wikipedia.org`'s. */
  readonly paragraph: ReactNode;
  readonly caption: ReactNode;
  /**
   * What is said under the article. Beat 2 says nothing, and still reserves the
   * row — see above.
   */
  readonly tail?: ReactNode;
  /**
   * Whether this paragraph lands on the one before it.
   *
   * Beat 2's drifts in from the right, calm; beat 3's comes back over it from
   * the left. A paragraph that arrived from the side its predecessor left
   * towards would read as a carousel rather than as a correction.
   */
  readonly over?: boolean;
}

export function ArticleBeat({
  headingId,
  title,
  body,
  paragraph,
  caption,
  tail,
  over = false,
}: ArticleBeatProps) {
  return (
    <section aria-labelledby={headingId} className="landing-article">
      <header className="landing-article__head">
        <h2 id={headingId} className="landing-move landing-move--fore text-3xl text-ink">
          {title}
        </h2>
        <p className="mt-3 max-w-[60ch] text-base text-ink-2">{body}</p>
      </header>

      <figure
        className={cn(
          'landing-move landing-article__sheet mt-6',
          over ? 'landing-move--over' : 'landing-move--from-right',
        )}
      >
        {/* No border and no shadow through `className`. The reading surface is
            exempt from the grammar and `ReadingSheet` refuses a prop for one —
            passing it as a class would be walking round the exemption rather
            than honouring it. Padding is all it gets.

            The ground is opaque, which is what lets beat 3's sheet cover beat
            2's as it lands rather than showing it through. */}
        <ReadingSheet as="div" lang="fr" className="p-6">
          <p>{paragraph}</p>
        </ReadingSheet>
        <figcaption className="landing-article__credit mt-2 text-xs text-muted">
          {caption}
        </figcaption>
      </figure>

      {/* The row, and then the sentence in it. Beat 2 renders the row empty:
          the space is what keeps the two sheets on the same rectangle, and a
          reserved row is cheaper than two layouts that agree by accident. */}
      <div className="landing-article__tail mt-4">
        {tail === undefined ? null : (
          <p className="max-w-[60ch] text-sm text-ink">{tail}</p>
        )}
      </div>
    </section>
  );
}
