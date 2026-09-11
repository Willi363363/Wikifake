// Step J.2 — `GET /icon/<size>`, one route and three sizes.
//
// **Generated rather than committed**, for the reason C.8 gives about the share
// card: a PNG in `public/` is a picture of the mark at the moment somebody
// exported it, and this repository has already watched a page wear a retired
// palette for a whole redesign because nothing could read a colour out of a
// file. Here the drawing is `src/brand/mark.tsx`, the palette is held to the
// theme by a test, and the three sizes come off one list.
//
// **At the root, not under `[locale]`.** The share card sits under the locale
// segment because it carries a sentence; an icon carries none. One drawing
// answers every language, so a second copy per locale would be two routes that
// can drift and one of them served to nobody in particular.
//
// Next writes the `<link rel="icon">` tags from this file and appends its own
// cache-busting query. `app/manifest.ts` names two of these paths without it —
// `apps/e2e/specs/icons.spec.ts` fetches both shapes, because a metadata route
// that 500s at runtime is a build that succeeded.
import { ImageResponse } from 'next/og';

import { archivo } from '../src/brand/fonts.js';
import { BrandMark, ICON_SIZES } from '../src/brand/mark.js';

export const contentType = 'image/png';

/**
 * One entry per size, and the id is the size.
 *
 * A readable URL is the point: `/icon/192` is what the manifest names, and a
 * generated `/icon/0` would be a number nobody can check against anything.
 */
export function generateImageMetadata(): {
  id: string;
  size: { width: number; height: number };
  contentType: string;
}[] {
  return ICON_SIZES.map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType,
  }));
}

/**
 * The size asked for, which arrives as a **promise**.
 *
 * Next's generated route calls `handler({ params, id })` with `id` still
 * unresolved — a promise, not the string the documentation's example destructures
 * as one. Comparing it to a number therefore never matches, and a fallback then
 * draws the first size in the list: `/icon/192` served a 32×32 PNG, with a 200
 * and the right content type, and every unit test still green.
 * `apps/e2e/specs/icons.spec.ts` is what read the bytes and failed.
 *
 * The id cannot be unknown by the time this runs — the generated route answers
 * 404 for an id `generateImageMetadata` did not return — so the fallback below
 * is unreachable rather than lenient. It is there because an `ImageResponse` of
 * `NaN` pixels is a 500 with no explanation in it.
 */
export default async function Icon({
  id,
}: {
  id: Promise<string>;
}): Promise<ImageResponse> {
  const asked = await id;
  const size =
    ICON_SIZES.find((candidate) => String(candidate) === asked) ?? ICON_SIZES[0];

  return new ImageResponse(<BrandMark size={size} />, {
    width: size,
    height: size,
    // One weight, because the mark is one glyph in the bold.
    fonts: [...(await archivo([800]))],
  });
}
