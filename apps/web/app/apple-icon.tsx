// Step J.2 — `GET /apple-icon`, the one iOS reads.
//
// A separate route rather than a fourth entry in `icon.tsx`, because it is a
// separate tag: iOS asks for `rel="apple-touch-icon"`, ignores the manifest
// entirely, and picks 180×180 whatever else is offered. Next emits that tag
// only from a file with this name.
//
// It is the same drawing at a different size, and that is the whole file — the
// mark, the fonts and the palette are `src/brand/`, so the two routes cannot
// disagree about what the icon looks like.
//
// **No transparency, and none is asked for**: iOS composites a touch icon onto
// its own ground and does not round the corners of what it is given. A square
// flat fill is exactly what the direction draws, so the one place a brutalist
// mark would have fought its platform is the one place it does not have to.
import { ImageResponse } from 'next/og';

import { archivo } from '../src/brand/fonts.js';
import { APPLE_ICON_SIZE, BrandMark } from '../src/brand/mark.js';

export const contentType = 'image/png';
export const size = { width: APPLE_ICON_SIZE, height: APPLE_ICON_SIZE };

export default async function AppleIcon(): Promise<ImageResponse> {
  return new ImageResponse(<BrandMark size={APPLE_ICON_SIZE} />, {
    ...size,
    fonts: [...(await archivo([800]))],
  });
}
