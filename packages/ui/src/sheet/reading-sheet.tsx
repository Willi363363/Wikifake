// The reading surface: the one place on the site that looks like nothing.
//
// `plans/product/01-art-direction.md` exempts the article's prose from the
// brutalist grammar, and this component is how that exemption is enforced by
// construction rather than by discipline. It owns the measure, the line height
// and the prose colours, and it carries no border, no shadow and no accent.
//
// The reason is not taste. The player's task is to detect a factual anomaly in
// prose, and every unit of visual noise around that prose is noise they have to
// filter before they can do the thing the game is for. A paragraph in a 3px box
// with a yellow fill is a paragraph nobody reads carefully.
//
// The chassis around it stays loud, and so does the act of marking a paragraph
// — that contrast is the design rather than a compromise in it.
//
// **It does declare a ground.** "No fill" means no accent, not no colour: a
// surface whose background is whatever it happens to sit on is a surface whose
// contrast nobody can measure. It is `surface`, so the prose pair is `ink` on
// `surface` — 21.00:1 light, 15.51:1 dark, the widest margin in the palette,
// and it is the one place that margin is spent on purpose.
//
// Anybody who later wants the article in a yellow box has to delete this
// component to do it, and the deletion shows up in a review. That is the point.
import type { ElementType, HTMLAttributes, ReactNode } from 'react';

import { cn } from '../cn.js';

export interface ReadingSheetProps extends HTMLAttributes<HTMLElement> {
  readonly children: ReactNode;
  /**
   * The element to render. `article` by default, because that is what it is.
   *
   * There is deliberately no prop for a border, a fill, a shadow or a tone: the
   * exemption is not configurable, and a component that took `variant="loud"`
   * would be one nobody had to argue with before using it.
   */
  readonly as?: ElementType;
}

export function ReadingSheet({ as, className, children, ...props }: ReadingSheetProps) {
  const Element = as ?? 'article';

  return (
    <Element
      className={cn(
        // 68 characters. The band where a line ends before the eye has to hunt
        // for the start of the next one, and `ch` rather than a pixel width so
        // it follows the type rather than guessing at it.
        'max-w-[68ch] bg-surface text-ink',
        'text-[1.02rem] leading-[1.68]',
        // Wikipedia prose carries chemical names, German compounds and bare
        // URLs. Without this a single word decides the width of the page.
        'break-words hyphens-auto',
        className,
      )}
      {...props}
    >
      {children}
    </Element>
  );
}
