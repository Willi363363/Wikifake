// `POST /api/theme` — step L.9, the palette a reader chose.
//
// **The one route in the catalogue whose request is a form and whose answer has
// no body.** Both are deliberate and neither is an oversight worth tidying:
//
//   - a form, because the switch has to work with no JavaScript, and the
//     alternative — a link — would be a `GET` that changes something, which
//     Next's prefetching would fire by itself as a pointer passed over it;
//   - no body, because the answer to the post is a redirect back to the page
//     the reader was on. A browser follows it and renders the page in the new
//     palette; there is nothing for it to parse.
//
// So the schemas below describe what is sent and what a caller may expect to
// find, which for the response is *nothing at all*. They are here rather than
// omitted because the parity test's whole subject is that no route exists
// outside this catalogue — an undescribed route is one with no contract and no
// generated documentation, and the exemption list is for somebody else's
// library, not for ours.
import { z } from 'zod';

/**
 * The three answers, and the reason `system` is one of them.
 *
 * It is not a synonym for light: a reader who has chosen nothing is asking the
 * machine, and most machines change their answer at dusk. The value is written
 * to the cookie like the other two, so *"I want to follow the system"* is a
 * choice somebody can make back after choosing dark once.
 */
export const themeChoice = z.enum(['system', 'light', 'dark']);
export type ThemeChoice = z.infer<typeof themeChoice>;

/**
 * What the form carries.
 *
 * `next` is where to return to, and it is the field with teeth: a form is
 * something anybody can post, and a redirect that trusted this value would
 * forward a visitor anywhere on the web with this site's domain in front of it.
 * The route validates it as a path on this site — `//host` refused as well as
 * `https://host` — and falls back to `/` rather than refusing the request.
 */
export const chooseThemeRequest = z.object({
  theme: themeChoice,
  next: z.string(),
});
export type ChooseThemeRequest = z.infer<typeof chooseThemeRequest>;

/** A 303 and a `set-cookie`. There is no body, and `never` says so. */
export const chooseThemeResponse = z.never();
export type ChooseThemeResponse = z.infer<typeof chooseThemeResponse>;
