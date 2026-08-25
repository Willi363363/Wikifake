// The solo round — step 7.8 wires it to the REST routes of phase 4.
//
// The entry screen leads here with the topic it collected. Deliberately bare:
// "do not anticipate phase 8" is one of this phase's pitfalls, and the round
// this becomes in 7.8 is itself replaced by phase 8.
//
// The `Suspense` is not decoration. Reading the query string is a client-side
// concern, and Next refuses to prerender a page that does it unbounded — without
// this the build fails outright, which is the right failure: the shell is static
// and only the part that needs the URL waits for the browser.
import { Suspense } from 'react';

import { SoloPlaceholder } from '../../../src/lobby/solo-placeholder.js';

export default function SoloPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <SoloPlaceholder />
    </Suspense>
  );
}
