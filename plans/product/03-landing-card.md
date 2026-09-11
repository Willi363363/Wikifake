# Track C — the card a shared link becomes

The record of step C.8. `03-landing.md` keeps the step table — the only place
that says where a step stands. The other three sheets: `03-landing-scene.md` is
how the scene was built, `03-landing-degraded.md` what reaches somebody who
never gets one, `03-landing-budget.md` what it costs to run.

## What was there, and why it is four problems rather than one

`apps/web/public/image.png`, declared as `og:image` and `twitter:image` since
step 10.0 and inherited from the Python stack before that:

| | |
|---|---|
| **1024×1024** | declared into a `summary_large_image` slot, which is 1.91:1. Every platform cropped it, none the same way. |
| **French only** | under an interface that has been English and French since phase 11. A shared English link advertised the game in French. |
| **Off the direction entirely** | a serif wordmark on a grey gradient, drawn before track A existed. Nothing in `01-art-direction.md` is in it. |
| **The Wikipedia globe** | a puzzle sphere of glyphs with a piece missing, which is the Wikimedia Foundation's registered mark. This project reads that encyclopaedia and falsifies what it reads; borrowing its logo to advertise doing so is the one visual decision here with a party outside this repository in it. |

Any one of them is a reason to redraw. Together they are why C.8 is a step with
a test rather than a file swap.

## Generated, not committed

`app/[locale]/opengraph-image.tsx` renders the card at request time through
`next/og`; `src/landing/share-card.tsx` is the card itself.

A PNG in `public/` is a picture of the copy at the moment somebody exported it,
and the four failures above are what that looks like after two years. This one
is built from the catalogue — `home.question`, `seo.tagline`, `seo.imageAlt` —
and from `excerpt.ts`, so a card that says something the site no longer says is
not a state the repository can be in. It is also the only way it is translated
at all: **one image per locale, from one file.**

`layout.tsx` therefore names no image. The file convention supplies the URL, the
width, the height and a per-locale alt; an explicit `openGraph.images` would
override it, which is exactly how the old one outlived four redesigns. Twitter
is given no image either, because Next inherits the Open Graph ones wherever it
has not been — so the card is stated once.

The alt comes from `generateImageMetadata` rather than the bare `alt` export the
docs show: `alt` is a module constant and cannot know which locale it is being
asked about, so the French card would have carried an English description of
itself.

## What the card says, and the one place it differs from the page

Four elements, in the order they are read: the brand as a yellow fill with a
hard offset shadow, the question at 104px in Archivo 800, a reading sheet
carrying the real extract with the falsified figure marked, and the tagline.

The grammar is `01-art-direction.md`'s, restated at the one scale where it has
to be: a card is shown at about 500 CSS pixels wide in a timeline and nearer 360
in a chat client, so a 3px border drawn on a 1200px canvas arrives as one and a
bit — a hairline, which is the one thing the direction says a border is never.
The canvas is 2.4× the widest display size, so the border is 8 and the offset
shadow is 16.

**The mark is a flat `green`, where the landing's is `green-soft`.** That is a
deliberate divergence and the only one. In the page the mark sits inside a sheet
a player reads several hundred words of, and a saturated block there is noise;
on a card looked at for half a second at 360 pixels, `#dbf7e6` on white is
nothing at all. `green` with `on-fill` is the debrief's verdict chip — a flat
fill in the direction's own words, measured at 12.52:1 — so the divergence is
between two things the design language already has, not away from it. Looked at
both ways before choosing.

The extract is French in both locales, for `excerpt.ts`'s reason: the game reads
`fr.wikipedia.org`, so a card showing an English paragraph would advertise a game
that does not exist. What crosses the language is the mark, which needs no words.
It is cut to fit — the pronunciation gloss out of the head, the tail at its first
clause — and both cuts are **derived** from the quoted strings rather than
retyped, so the card cannot drift from the revision `excerpt.ts` names.

## The fonts are committed, and the documented way to load them does not work

`next/og` bundles one face, a regular-weight Geist. On a direction whose first
rule is "a very bold grotesque", that is not a near miss, and there is no
supported way to reach the Archivo `next/font/google` downloads for the pages.

So both weights are in `src/landing/fonts/`, under the SIL Open Font License
that `LICENSE.txt` beside them carries: 220kB for the pair, against the 630kB
PNG this step deletes. Fetching them from Google at request time would put a
third party between a shared link and its card, on a path with no fallback.

**Next's own example is `fetch(new URL('./font.ttf', import.meta.url))`, and it
cannot work here.** Webpack rewrites that expression into the asset URL it
emitted — `/_next/static/media/…` — and a server-side `fetch` of a path with no
origin throws `ERR_INVALID_URL`. The build succeeds. The route 500s. Nothing
else notices, because no unit test fetches an image.

`fs.readFile` from `process.cwd()` is what works, and the output tracer cannot
follow a path built by `join()` — so `next.config.ts` names the two files in
`outputFileTracingIncludes`, or the deployed function ships without them and
fails on a platform rather than locally.

## The proxy had to be told

Next writes the segment into the tag, so the English card is at
`/en/opengraph-image/card` — and under `localePrefix: 'as-needed'` the locale
proxy redirected that to the unprefixed path, mangling the cache-busting query
Next appends as a bare key on the way. A 307 is a card some scrapers fetch and
some quietly give up on.

`isLocaleExempt` now names the metadata routes. The locale is in that path
because the *image* is translated; there is nothing left for locale routing to
decide.

## What is checked, and where

- **`share-card.test.tsx`** — the palette, by the method
  `global-error.palette.test.ts` established: every hex the card draws with must
  be a token's value, character for character, and nothing else. The card is
  inline style objects, so `fills.test.ts` cannot see a single colour in it, and
  that is precisely the gap the crash page fell into. Plus the grammar — no
  radius, no blur, no gradient, no translucency — and the thing that would
  quietly ruin it: the marked figure must be `claim` and never `truth`, because
  a card highlighting `330 m` demonstrates a correct encyclopaedia.
- **`proxy.test.ts`** — the metadata routes are exempt and the pages around them
  are not.
- **`landing-share-card.spec.ts`** — the only place that can see the image
  exists. The tag is emitted, it is per locale, and what it points at answers
  200 with `image/png` whose own header reads 1200×630 — fetched with
  `maxRedirects: 0`, so a redirect fails rather than being followed quietly.
  Verified to have teeth: with the proxy exemption pointed at a path that
  matches nothing, it fails with `307`.

Both failures above were found by that spec and by nothing else. A build that
succeeds and a link that arrives bare is the shape this step is guarding against.

## What is left for track J

The copy. `seo.tagline` and `seo.imageAlt` are written to be true rather than to
be good, and sharpening the landing's words is track J's step — this is the
mechanism that makes sharpening them enough.
