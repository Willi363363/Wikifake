// `/shop` — step H.7.
//
// The same three answers `/quests` gives, and for the same reasons. No session
// is somebody who has not signed in. An **anonymous session is a guest**, and a
// guest is sent to sign up rather than shown a shop — not for tidiness, but
// because a guest's ledger is deleted the moment they sign up: `coin_movement`
// cascades on `user_id`, so a cosmetic bought as a guest is a cosmetic that
// vanishes with the receipt. Selling somebody something that disappears is worse
// than not selling it.
//
// An account with no pseudonym goes where every game screen sends it:
// `/choose-a-name` is the one screen an account in that state can finish, and
// `setWornCosmetic` would refuse it anyway — `profile` is the row that holds
// what is worn.
import type { Metadata } from 'next';

import { robotsFor } from '../../../src/indexing.js';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '../../../src/auth/auth.js';
import { CHOOSE_A_NAME, readViewer } from '../../../src/account/gate.js';
import { db } from '../../../src/game/wiring.js';
import { ShopScreen } from '../../../src/shop/screen.js';
import { readShop } from '../../../src/shop/stock.js';

/** Not content, and not a page any crawler should hold: it is one player's. */
export const metadata: Metadata = { robots: robotsFor('/shop') };

/** Never prerendered: it reads a cookie and answers differently per player. */
export const dynamic = 'force-dynamic';

export default async function ShopPage() {
  const session = await auth().api.getSession({ headers: await headers() });

  if (session === null) redirect('/sign-in');
  if (session.user.isAnonymous === true) redirect('/sign-up');

  const viewer = await readViewer();
  if (viewer.pseudonym === undefined) redirect(CHOOSE_A_NAME);

  const shop = await readShop({ db: db() }, session.user.id);

  return <ShopScreen shop={shop} />;
}
