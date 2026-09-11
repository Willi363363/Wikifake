// `/sign-in` — step E.2.
//
// Outside the `(game)` route group on purpose: that group's layout mounts the
// socket provider, and a player signing in has no room to connect to. It is the
// same reason the front door is not in it.
//
// `noindex`, because a sign-in form is not content. `robots.ts` keeps crawlers
// out of the screens that *render* falsified articles; this is the other kind
// of page a crawler should not spend a visit on, and saying so per page is
// cheaper than growing the disallow list.
import type { Metadata } from 'next';

import { robotsFor } from '../../../src/indexing.js';

import { AccountScreen } from '../../../src/account/account-screen.js';
import { offeredProviders } from '../../../src/auth/providers.js';
import { loadEnv } from '@wikifake/env';

export const metadata: Metadata = { robots: robotsFor('/sign-in') };

export default function SignInPage() {
  return <AccountScreen mode="signIn" providers={offeredProviders(loadEnv())} />;
}
