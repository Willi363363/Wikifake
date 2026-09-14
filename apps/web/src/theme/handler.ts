// `POST /api/theme` — the choice, written where the next request can read it.
//
// A form post and not a link, and that is a correctness decision rather than a
// stylistic one. Next prefetches links: a `GET` that set the cookie would flip
// a reader's palette because their pointer passed over the switch, and a
// crawler would do it on every page it fetched. The rule it follows is the
// ordinary one — a request that changes something is not a `GET`.
//
// A form post and not a client component writing `document.cookie`, for the
// reason `13-ui-overhaul.md` gives about the phone menu: what breaks first is
// JavaScript, and a control that needs it is a control that is missing exactly
// when the page is hardest to read. This one is a `<form>` and a 303.
import { safeReturn, THEME_COOKIE, THEME_COOKIE_MAX_AGE, themeFrom } from './choice.js';

/**
 * Accepts a theme, sets the cookie, and sends the reader back where they were.
 *
 * **303 and not 302**, because the answer to a post is a page to get: a 302
 * leaves the method to the client, and a browser that repeated the post would
 * re-submit the choice on every back button.
 *
 * Anything unreadable falls back to `system` rather than being refused.
 * A palette is not a thing to show somebody an error page about, and
 * `themeFrom` already treats every value it does not know as no choice at all.
 */
export async function handleChooseTheme(request: Request): Promise<Response> {
  const form = await request.formData().catch(() => null);
  const theme = themeFrom(form?.get('theme')?.toString());
  const back = safeReturn(form?.get('next')?.toString() ?? null);

  const headers = new Headers({ location: back });
  headers.append(
    'set-cookie',
    [
      `${THEME_COOKIE}=${theme}`,
      'path=/',
      `max-age=${String(THEME_COOKIE_MAX_AGE)}`,
      // `lax`, like the locale's: the cookie has to survive arriving from a
      // shared link, and it carries a palette rather than an identity.
      'samesite=lax',
    ].join('; '),
  );

  return new Response(null, { status: 303, headers });
}
