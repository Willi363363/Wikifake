// C7.3 — the front door, which has to be a page.
//
// It was a redirect to `/play` until step 10.0, and that is a contract
// violation rather than a style choice: C7.3 says `GET /` answers HTML 200 with
// a non-empty `<title>`, and a redirect answers 307 with no document at all. The
// probe and the crawler both read the literal response, and the sitemap declares
// this URL — a declared URL that redirects is a declared URL a crawler drops.
//
// Not a copy of the entry screen, which is the reason the redirect existed. The
// entry lives inside the `(game)` group because the socket provider has to be
// mounted before a room is opened, and duplicating it here would be a second
// place to keep in step. This is the one thing that group cannot hold: a static,
// server-rendered, indexable page. It says what the game is and points at it.
//
// Since step 11.1 the copy lives in `messages/<locale>/home.json` and is read
// through `next-intl` — this page is the proof screen: the first one rendered
// through the catalogue in both locales (`page.locale.test.tsx`). Since step
// 11.5 the metadata in `layout.tsx` is per-locale and reads the catalogue's
// `seo` zone; its test pins that zone's description to this page's, so the
// search result and the front door keep speaking one sentence.
//
// Since step C.1 the page itself is `src/landing/` — four beats told as a plain
// document, which is what track C's scene will later be laid over. The route
// stays a server component and stays static: that is what C7.3 measures.
import { Landing } from '../../src/landing/landing.js';
import { PageView } from '../../src/traffic/page-view.js';

export default function HomePage() {
  return (
    <>
      <Landing />
      {/* Step J.4 — the arrival, counted. It renders nothing and it is the only
          reason this page touches the server at all: everything above is
          prerendered, so without a beacon a visit that ends here leaves no
          trace anywhere. */}
      <PageView page="landing" />
    </>
  );
}
