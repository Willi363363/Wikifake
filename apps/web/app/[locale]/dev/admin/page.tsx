// `/dev/admin` — a scratch route, and it says so in its address.
//
// Three candidate navigations for the admin panel, rendered in the real stack
// so that what is being judged is the thing itself rather than a picture of it.
// It reads nothing, writes nothing and gates nothing: there is no data on this
// page, which is why it does not go through `requireAdmin`.
//
// **It is not a product screen.** It lives under `/dev` so that `robots.txt`
// keeps every crawler out of the whole prefix rather than one route at a time,
// and it is deleted — or gated — with the decision it exists to settle.
import type { Metadata } from 'next';

import { RailLab } from '../../../../src/dev/rail-lab.js';
import { robotsFor } from '../../../../src/indexing.js';

export const metadata: Metadata = { robots: robotsFor('/dev/admin') };

export default function DevAdminPage() {
  return <RailLab />;
}
