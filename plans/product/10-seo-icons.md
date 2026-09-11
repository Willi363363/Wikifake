# Track J — the mark, the icons and the manifest

The record of step J.2. `10-seo-and-legal.md` keeps the step table — the only
place that says where a step stands.

## The mark: a question mark, and why not a letter

The wordmark the share card wears — WIKIFAKE, spaced, in a yellow box — is
unreadable at 16 CSS pixels, which is what a browser tab shows. The obvious
reduction is its initial, and **a yellow "W" is the one thing this project must
not draw**: Wikipedia's own favicon is a W, this game reads `fr.wikipedia.org`
without being endorsed by the foundation, and step C.8 already refused the globe
for exactly that reason.

The landing's first line is "Who is lying?". The question is the game, it is
nobody's mark, and it survives being sixteen pixels wide.

The grammar is `01-art-direction.md`'s, restated at this scale the way the share
card restates it at its own: a flat accent fill, a square, and a structural
border that is a **proportion** — a sixteenth of the canvas, so 2 pixels at 32
and 32 at 512. Three pixels on a 512px canvas is a hairline, and a hairline is
the one thing the direction says a border is never. What the icon does not carry
is the offset shadow: a shadow is a distance between a surface and the one
behind it, and an icon has nothing behind it.

## The one colour decision, and the test that holds it

An icon is stamped into a tab strip, a home screen and an OS switcher, none of
which tell a page which palette they are in — and several of which draw it on
their own ground. So the mark may only use colours that **do not move between
the palettes**: `accent` and `on-fill`, two of the seven in `THEME_INDEPENDENT`.

`mark.palette.test.ts` holds three claims rather than one: the two hex literals
are the theme's values, nothing else is drawn, and the two tokens are declared
identically in *both* palettes. The third is the one that matters here — a token
that quietly became theme-dependent would give the icon a colour that is right
in one theme and wrong in the other, on a surface that never changes.

## Generated, not committed

Four PNGs and none of them in `public/`. The reasoning is C.8's, and it has
already been paid for once in this repository: a committed image is a picture of
the brand at the moment somebody exported it, and the crash page wore a retired
palette through an entire redesign because no scanner could read a colour out of
a file. Here the drawing is `src/brand/mark.tsx`, every colour is held to
`theme.css` by a test, and the sizes come off one list that `manifest.ts` reads
too — so the manifest cannot promise an icon at a size nothing draws.

The fonts moved with it. `src/landing/fonts/` became `src/brand/fonts/` and the
loading became `src/brand/fonts.ts`, because the icons are its second and third
reader and the alternative was a third copy of a twenty-line comment about why
the documented `fetch(new URL(…))` does not work. `next.config.ts` names the
files for all six routes that trace them.

## What the browser test found, and the unit tests could not

`/icon/192` served a **32×32** PNG. Status 200, `Content-Type: image/png`, every
unit assertion green.

Next's generated route calls `handler({ params, id })` with `id` still a
**promise** — not the string its own documentation example destructures as one.
Comparing it to a size therefore never matched, the fallback drew the first
entry in the list, and every icon in the application was the small one scaled up
by whatever asked for it.

Nothing that reads source could see this: the file is correct TypeScript, the
route answers, and the bytes are a valid PNG. `apps/e2e/specs/icons.spec.ts`
reads the `IHDR` chunk out of the response, which is what failed.

## Three smaller decisions, recorded because they will be questioned

**No maskable icon.** A maskable icon is cropped to the platform's own shape,
and a mark whose border *is* the grammar cannot be cropped. A maskable variant
would be a second drawing, which is not what this step is for. Android puts the
square tile on its own ground instead, which is what a stamp should do.

**`/favicon.ico` is a rewrite.** `app/icon.tsx` makes Next stop serving that
path, and the clients that ask for it by name — feed readers, link unfurlers,
older browsers — are the ones least likely to read the document to find out
otherwise, and least likely to follow a redirect. `next.config.ts` rewrites it
onto `/icon/32`: a PNG under an `.ico` name, which all of them read.

**The manifest is in one language, and that is a limitation.** Next serves a
manifest from the application root only; there is no `[locale]` segment to put
it under, and an OS reads it once, at install time, from a URL with no language
in it. The words come from the catalogue — never from a literal — but from the
default locale of it. **A French player who installs the game gets an English
home-screen label.** Negotiating a document the OS caches indefinitely is its
own decision, and it is not this step's.

## What it cost the proxy

`/icon/192` and `/apple-icon` have no locale prefix, because a mark carries no
sentence — and no file extension either, so the matcher's file rule does not
exempt them the way it exempts `/robots.txt`. Without an entry in
`METADATA_ROUTES` the proxy rewrites `/icon/192` to `/en/icon/192`, which is a
404 where a home screen expected a picture. It is the mirror image of what C.8
hit, where the card had to *keep* a prefix the proxy wanted to strip.
