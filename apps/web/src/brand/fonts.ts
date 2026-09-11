// Archivo, for the images this application draws rather than lays out.
//
// Three metadata routes need the face now — the share card, the icons and the
// Apple icon — so the loading lives here rather than being copied a third time.
// The files moved with it: they were under `src/landing/` when the card was
// their only reader, and they serve the brand, not one page.
//
// **Read from disk, not fetched, and the documented way round does not work.**
// Next's own example is `fetch(new URL('./font.ttf', import.meta.url))`;
// webpack rewrites that expression into the *asset* URL it emitted —
// `/_next/static/media/…` — and a server-side `fetch` of a path with no origin
// throws `ERR_INVALID_URL`. The build succeeds and the route 500s, which is an
// image nobody sees fail until they look for it. `apps/e2e/specs` look for it.
//
// `process.cwd()` is the application directory under `next start` and under a
// traced deployment alike; `next.config.ts` names these files in
// `outputFileTracingIncludes` for every route below, because the tracer walks
// imports and cannot see through a runtime `join`.
//
// Committed rather than downloaded, under the SIL Open Font License that
// `fonts/LICENSE.txt` carries: `next/font/google` fetches Archivo at build time
// for the *pages*, and there is no supported way to reach those files from a
// metadata route. Without them the drawing falls back to the regular-weight
// Geist that `next/og` bundles, on a direction whose first rule is "a very bold
// grotesque".
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** The two weights the repository carries, and the only two it may ask for. */
export type ArchivoWeight = 400 | 800;

/** What `ImageResponse` calls a font. */
export interface LoadedFont {
  readonly name: 'Archivo';
  readonly data: Buffer;
  readonly weight: ArchivoWeight;
}

const FONTS = join(process.cwd(), 'src', 'brand', 'fonts');

/**
 * The weights asked for, read off disk.
 *
 * A drawing that uses one weight loads one file: the icon is a single glyph in
 * the bold, and reading 110kB of regular for it would be paid on every cold
 * start of the route.
 */
export async function archivo(
  weights: readonly ArchivoWeight[],
): Promise<readonly LoadedFont[]> {
  return Promise.all(
    weights.map(async (weight) => ({
      name: 'Archivo' as const,
      data: await readFile(join(FONTS, `archivo-${String(weight)}.ttf`)),
      weight,
    })),
  );
}
