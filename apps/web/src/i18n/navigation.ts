// The navigation primitives, taught the routing above.
//
// `Link` from here knows two things `next/link` does not: a plain `href`
// stays in the locale the player is in, and an explicit `locale` prop is the
// language switch — same path, other prefix, and the choice cookie written on
// the way so the proxy keeps honouring it on the next request.
//
// The screens themselves keep `next/navigation` on purpose: they navigate
// with unprefixed paths, and the proxy resolves those against the player's
// cookie. Only code that has to *name* a locale — the switch — needs these.
import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing.js';

export const { Link, getPathname, redirect, usePathname, useRouter } =
  createNavigation(routing);
