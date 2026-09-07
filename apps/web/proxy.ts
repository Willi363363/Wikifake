// The request step every page passes through — Next 16's name for middleware.
//
// One job: localised routing, steps 11.3 and 11.4. `next-intl` resolves the
// locale — URL prefix first, then the player's choice cookie, then
// `Accept-Language`, then English — and rewrites or redirects so every page
// renders under `app/[locale]` while English keeps the unprefixed URLs C7.3
// and the sitemap already name. A legacy URL therefore never 404s: `/play` is
// served as English or redirected to `/fr/play`, whichever the player is owed.
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { routing } from './src/i18n/routing.js';

const handleLocaleRouting = createIntlMiddleware(routing);

/**
 * Next's generated metadata routes, which are per-locale already.
 *
 * Step C.8 added `app/[locale]/opengraph-image.tsx`, so the share card lives at
 * `/en/opengraph-image/card` and `/fr/opengraph-image/card` — and Next writes
 * those exact URLs into the `og:image` tag, prefix and all. Under `as-needed`
 * the proxy would redirect the English one to the unprefixed path, and a 307 is
 * a card that some scrapers fetch and some quietly give up on. It also mangles
 * the cache-busting query, which Next appends as a bare key.
 *
 * These are not pages and carry no interface prose: the locale is in the path
 * because the *image* is translated, and there is nothing left for locale
 * routing to decide.
 */
const METADATA_ROUTES = ['/opengraph-image'];

/**
 * The paths locale routing must leave alone.
 *
 * The API and the probe are not pages — rewritten under `/en` they would 404.
 * Next's internals and anything with a file extension (`/robots.txt`,
 * `/sitemap.xml`, images) serve one answer whatever the language.
 */
export function isLocaleExempt(pathname: string): boolean {
  if (pathname === '/ping') return true;
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) return true;
  if (METADATA_ROUTES.some((route) => pathname.includes(route))) return true;
  // A dot in the last segment is a file, and files are not translated.
  return pathname.slice(pathname.lastIndexOf('/') + 1).includes('.');
}

export default function proxy(request: NextRequest): NextResponse {
  // The matcher below already keeps the exempt paths out in production; they
  // are checked again here so the exemption is behaviour of the function
  // rather than only configuration — and therefore something a test can call.
  if (isLocaleExempt(request.nextUrl.pathname)) return NextResponse.next();
  return handleLocaleRouting(request);
}

export const config = {
  // Everything except the API, the probe, Next's internals and files. The
  // same rule as `isLocaleExempt`, in the syntax Next requires be constant.
  matcher: ['/((?!api|ping|_next|_vercel|.*\\..*).*)'],
};
