// C6.2, C6.3 — what a crawler is told, and what a shared link shows.
//
// The game displays Wikipedia articles whose facts have been **deliberately**
// falsified. Indexed, they would be presented by a search engine as
// encyclopaedic information and attributed to Wikipedia: that is the most
// serious risk the project carries, and it is why this file is a contract
// clause rather than a growth tactic.
//
// The old stack held this in three static files under `frontend/public/`. Here
// the rules are functions of the deployment's own origin, because there are two
// origins now — a Vercel preview and production — and a copied `robots.txt`
// naming one of them would name the wrong one on the other. The two route files
// `app/robots.ts` and `app/sitemap.ts` are the thin shells Next asks for; the
// decisions are here, where a test can read them without a server.
//
// Like `deployment.ts`, this does **not** go through `loadEnv`: a crawler asking
// for `robots.txt` should not be answered with a validation failure about the
// database.
import type { Environment } from './deployment.js';
import { DEFAULT_LOCALE, LOCALES, type Locale } from './i18n/locales.js';

/**
 * Crawlers refused outright, for a reason stronger than indexing.
 *
 * This corpus is misinformation by construction. It has no business in a
 * training set, and the four names below are the ones that can be told so.
 */
export const TRAINING_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'Google-Extended',
  'CCBot',
] as const;

/**
 * Paths no crawler is invited into.
 *
 * `/api/` and `/ws/` are the contract's own two, and they are the ones that
 * serve falsified content. The three that follow are the routes that *render*
 * it — a room, a solo game, and the component gallery, which is a development
 * surface that happens to ship. Crawling any of them yields a shell, since the
 * article arrives over the socket, but a shell in an index is still a page
 * claiming to be about a Wikipedia subject.
 */
export const CRAWLERS_KEPT_OUT = [
  '/api/',
  '/ws/',
  '/room/',
  '/solo',
  '/gallery',
] as const;

/**
 * The routes that are ours to publish: the front door and the way in.
 *
 * Deliberately short. The old sitemap had one URL and a comment explaining that
 * the rest of the site is a game, not content — that is still true.
 */
export const INDEXABLE_ROUTES = ['/', '/play'] as const;

// The title and the description used to live here as English constants. Step
// 11.5 moved them into the catalogue — `messages/<locale>/seo.json` — because
// a search result is interface copy like any other, and C6.3's bounds are now
// asserted per locale in `app/[locale]/layout.test.tsx`.

/**
 * Where this deployment answers from, as an absolute origin with no trailing
 * slash.
 *
 * Four sources, most specific first. `NEXT_PUBLIC_SITE_URL` is the deliberate
 * one, set for production so a canonical link never points at a preview.
 * `VERCEL_PROJECT_PRODUCTION_URL` and `VERCEL_URL` are Vercel's own — bare
 * hostnames, hence the scheme added here. `BETTER_AUTH_URL` is the app's URL
 * where one is already configured, and localhost is what is left.
 */
export function siteOrigin(source: Environment = process.env): string {
  const explicit = source['NEXT_PUBLIC_SITE_URL'];
  if (explicit !== undefined && explicit !== '') return withoutTrailingSlash(explicit);

  const vercel = source['VERCEL_PROJECT_PRODUCTION_URL'] ?? source['VERCEL_URL'] ?? '';
  if (vercel !== '') return `https://${withoutTrailingSlash(vercel)}`;

  const auth = source['BETTER_AUTH_URL'];
  if (auth !== undefined && auth !== '') return withoutTrailingSlash(auth);

  return 'http://localhost:3000';
}

function withoutTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

/**
 * Where a route lives in one locale's URL space.
 *
 * The default locale keeps the unprefixed URLs C7.3 and the sitemap name; the
 * others carry their prefix (step 11.4). The root of a prefixed locale is the
 * bare prefix, because that is the URL the proxy serves it under.
 */
export function localePath(locale: Locale, route: string): string {
  if (locale === DEFAULT_LOCALE) return route;
  return route === '/' ? `/${locale}` : `/${locale}${route}`;
}

/** An absolute URL for one of our routes, from the origin this deployment has. */
export function absolute(route: string, source: Environment = process.env): string {
  return route === '/' ? `${siteOrigin(source)}/` : `${siteOrigin(source)}${route}`;
}

/** The shape Next's `robots.ts` returns, named so the route file stays a shell. */
export type RobotsRules = {
  rules: { userAgent: string; allow?: string[]; disallow: string[] }[];
  sitemap: string;
};

/**
 * C6.2 — the rules, as data.
 *
 * Two kinds of entry: everybody, kept out of the paths above, and the four
 * training crawlers, kept out of everything. The sitemap is declared here
 * rather than only existing, because a sitemap nothing points at is a file
 * nobody fetches.
 */
export function robotsRules(source: Environment = process.env): RobotsRules {
  // Step 11.4 gave every locale but the default its own URL prefix, so a rule
  // written for `/room/` no longer covers `/fr/room/` — the same falsified
  // content, one prefix later. Derived from the locale list rather than
  // hand-written, so a third language cannot ship crawlable screens. Uniform
  // over the kept-out paths on purpose: this is a statement about URL space,
  // and a disallow for a path nothing serves keeps nothing in.
  const prefixes = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).map(
    (locale) => `/${locale}`,
  );
  const keptOut = CRAWLERS_KEPT_OUT.flatMap((path) => [
    path,
    ...prefixes.map((prefix) => `${prefix}${path}`),
  ]);

  return {
    rules: [
      { userAgent: '*', allow: ['/'], disallow: keptOut },
      ...TRAINING_CRAWLERS.map((userAgent) => ({ userAgent, disallow: ['/'] })),
    ],
    sitemap: absolute('/sitemap.xml', source),
  };
}

/**
 * One entry per publishable route and per locale, routes in the order they
 * are declared, the default locale first within each route.
 *
 * Step 11.5: a French page a sitemap never names is a French page a crawler
 * finds late or not at all. The locale versions of one route share its
 * priority — they are the same page, not competitors.
 */
export function sitemapEntries(
  source: Environment = process.env,
): { url: string; changeFrequency: 'weekly'; priority: number }[] {
  return INDEXABLE_ROUTES.flatMap((route, index) =>
    LOCALES.map((locale) => ({
      url: absolute(localePath(locale, route), source),
      changeFrequency: 'weekly' as const,
      // The front door first. A sitemap that ranks everything equally ranks
      // nothing, and the entry screen is one navigation behind the landing page.
      priority: index === 0 ? 1 : 0.8,
    })),
  );
}
