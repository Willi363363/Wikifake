'use client';

// The browser's half of Better Auth — step E.2.
//
// Everything before this step drove `auth.handler` directly, from a test. A
// screen cannot: it needs the fetch, the cookie and the session state, and
// writing those by hand would be a second implementation of a protocol the
// library owns.
//
// **No `baseURL`, deliberately.** The client defaults to the page's own origin,
// which is what a browser should always use: a preview deployment posting its
// sign-in to production's origin would authenticate there and set the cookie
// there, and the visible symptom is a form that appears to do nothing. The one
// place an absolute URL belongs is the *server's* `BETTER_AUTH_URL`, which is
// what OAuth redirect URIs are built from — and `assertCallbackReachable`
// guards that one.
import { anonymousClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/**
 * The client, and the one plugin it needs — step E.6.
 *
 * `anonymousClient()` is the browser half of the `anonymous()` plugin the server
 * runs. It adds no behaviour this application calls: what it adds is
 * `isAnonymous` on the session user, which is how a screen tells a guest from an
 * account without asking the server a second question. Without it that field is
 * present in the payload and absent from the type, and the only way to read it
 * would be a cast — which is a lie whenever the server plugin is removed.
 */
export const authClient = createAuthClient({ plugins: [anonymousClient()] });

/**
 * What a failed call gives a screen to show.
 *
 * Better Auth answers `{ data, error }` rather than throwing, and its `error`
 * carries a message written for a person. That message is the server's and it
 * is the better one — "user already exists" beats anything this screen could
 * invent — so it is used when present, and the caller supplies a fallback for
 * the case where the request never arrived at all.
 */
export function failureOf(
  error: { message?: string | undefined } | null | undefined,
  fallback: string,
): string {
  const said = error?.message?.trim();
  return said === undefined || said === '' ? fallback : said;
}
