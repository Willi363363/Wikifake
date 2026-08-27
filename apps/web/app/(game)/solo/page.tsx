// The solo round, wired to `POST /api/game/start` and `POST /api/game/submit`.
//
// The entry screen leads here with the topic it collected. What the round shows
// is deliberately bare: "do not anticipate phase 8" is one of this phase's
// pitfalls, and phase 8 replaces the round entirely.
//
// The `Suspense` is not decoration. Reading the query string is a client-side
// concern, and Next refuses to prerender a page that does it unbounded — without
// this the build fails outright, which is the right failure: the shell is static
// and only the part that needs the URL waits for the browser.
import { Suspense } from 'react';

import { SoloEntry } from '../../../src/solo/entry.js';

export default function SoloPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <SoloEntry />
    </Suspense>
  );
}
