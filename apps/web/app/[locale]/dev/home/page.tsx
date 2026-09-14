// The interface bench — step L.1.
//
// Ungated on purpose: it reads nothing, holds no session and renders a
// constant. `/dev` is a prefix in `CRAWLERS_KEPT_OUT`, so nothing under it is
// crawled, and `robotsFor` gives this page the same `noindex` every other
// unindexed route declares.
//
// It is scratch. L.8 deletes `src/dev/`, this route, and the prefix with it —
// the same ending K.12 gave the last one, for the same reason: a mockup left in
// a repository is read as a specification by the next person.
import type { Metadata } from 'next';

import { Lab } from '../../../../src/dev/lab.js';
import { robotsFor } from '../../../../src/indexing.js';

export const metadata: Metadata = { robots: robotsFor('/dev/home') };

export default function DevHomePage() {
  return <Lab />;
}
