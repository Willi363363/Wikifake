// The catalogue, for component tests.
//
// Since step 11.2 the round's components read their copy through `next-intl`,
// which resolves against `NextIntlClientProvider` — in production the root
// layout mounts it, so a test that renders a component without one is a test
// rendering a tree production never mounts. This wraps `render` with the
// English provider once, instead of every suite carrying its own.
//
// English deliberately: the suites assert the English copy, and the French
// rendering is proven where French is the point (`page.locale.test.tsx`, and
// step 11.6's screens), not incidentally in every unit test.
import { render as renderBare, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

import home from '../../messages/en/home.json';
import round from '../../messages/en/round.json';

/** Statically imported: a test harness has no business being async. */
const MESSAGES = { home, round };

function EnglishCatalogue({ children }: { readonly children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={MESSAGES}>
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * `render`, with the English catalogue provided.
 *
 * A drop-in for `@testing-library/react`'s: the wrapper rides through
 * `rerender` too, so the `view.rerender(...)` idiom the suites use keeps
 * working unchanged.
 */
export function render(
  ui: ReactElement,
  options: Omit<RenderOptions, 'wrapper'> = {},
): ReturnType<typeof renderBare> {
  return renderBare(ui, { ...options, wrapper: EnglishCatalogue });
}
