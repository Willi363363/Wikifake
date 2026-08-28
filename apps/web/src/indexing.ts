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
import routes from '../messages/en/routes.json';

import type { Environment } from './deployment.js';

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

/**
 * The title, between 20 and 80 characters.
 *
 * Under 20 a search result says nothing; over 80 it is cut off.
 *
 * Step 11.2: the words live in the message catalogue (`routes` zone), not
 * here. The English file is read directly, and deliberately so — the metadata
 * is served in one language until step 11.5 makes it per-locale alongside the
 * `hreflang` alternates, exactly as `src/i18n/request.ts` pins the request
 * locale until step 11.3. The constant remains so the bounds tests keep one
 * name to hold, whatever file the copy lives in.
 */
export const SITE_TITLE: string = routes.metadata.title;

/**
 * The description, between 70 and 320 characters.
 *
 * Same reasoning: under 70 it earns no click, over 320 Google truncates it.
 * Same source as the title — one catalogue entry, reused by the document
 * `<meta>`, Open Graph and the Twitter card.
 */
export const SITE_DESCRIPTION: string = routes.metadata.description;

/**
 * The name a shared link is filed under — `og:site_name`.
 *
 * The brand, not a sentence: it reads the same in every locale, but it lives
 * in the catalogue like every other word the layout says, so nothing
 * user-facing is hardcoded there.
 */
export const SITE_NAME: string = routes.metadata.siteName;

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
  return {
    rules: [
      { userAgent: '*', allow: ['/'], disallow: [...CRAWLERS_KEPT_OUT] },
      ...TRAINING_CRAWLERS.map((userAgent) => ({ userAgent, disallow: ['/'] })),
    ],
    sitemap: absolute('/sitemap.xml', source),
  };
}

/** One entry per publishable route, in the order they are declared. */
export function sitemapEntries(
  source: Environment = process.env,
): { url: string; changeFrequency: 'weekly'; priority: number }[] {
  return INDEXABLE_ROUTES.map((route, index) => ({
    url: absolute(route, source),
    changeFrequency: 'weekly' as const,
    // The front door first. A sitemap that ranks everything equally ranks
    // nothing, and the entry screen is one navigation behind the landing page.
    priority: index === 0 ? 1 : 0.8,
  }));
}
