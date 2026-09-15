// The article of the day, played — step N.7.
//
// The same journey as `/solo` with its first request changed, which is why it
// renders the same component rather than a second copy of it: everything after
// the article arrives — the round, the hints, the debrief — is identical, and
// two files would be two hundred lines kept in step by hand.
//
// **No `Suspense` and no query string.** `/solo` needs one because it reads its
// topic from the URL, which Next refuses to prerender unbounded. The day has no
// topic to read: the server chose it, so there is nothing here the browser has
// to supply.
import { SoloGame } from '../../../../src/solo/solo.js';

export default function TodayPage() {
  return <SoloGame topic={null} daily />;
}
