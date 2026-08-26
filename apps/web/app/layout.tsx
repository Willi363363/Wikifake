// The document every page is rendered into.
//
// The first one: until now this application served routes and no pages at all.
// What it carries is deliberately minimal — the screens are phases 7 and 8, and
// a layout that started deciding navigation would be deciding them here.
//
// `lang="fr"` is C6.3, and it stays here for now even though the interface above
// it is English. Two things are true at once: the article, the topics and the
// falsifications are French, and every word the game itself says is not. The
// honest markup is `lang="en"` on the document with the article's own text
// marked `lang="fr"` — which is half done, in `round/article.tsx`.
//
// The other half is **step 11.5's**, and deliberately: `lang` is a clause of
// `02-contract-transport-and-compliance.md`, and phase 11 amends the clause and
// its test together when the attribute becomes per-locale. Changing it here
// would be changing a preserved guarantee in a step that does not own it.
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

/**
 * C6.3 — the metadata, in the language of the interface.
 *
 * English from step 8.10, like every other word the game says. It becomes
 * per-locale in step 11.5, alongside the `hreflang` alternates.
 */
export const metadata: Metadata = {
  title: 'WikiFake',
  description:
    'A misinformation game: a Wikipedia article, some errors slipped into it, and you.',
};

/**
 * Declared rather than left to a default.
 *
 * Without it a phone lays the page out at about 980 CSS pixels and scales the
 * result down, and every breakpoint below `lg` is dead code — which is the state
 * the current game ships in for all but one of its screens. Next supplies this
 * by default; naming it is what makes it a decision somebody can see.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-bg text-ink">{children}</body>
    </html>
  );
}
