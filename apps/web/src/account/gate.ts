// Who is asking, and whether they have told anybody their name — step E.3.2.
//
// **A `profile` row is a pseudonym that has been chosen**, so its absence is
// what marks an account that has not chosen one. That is the whole state
// machine, and it has three answers rather than two:
//
//   - **no session** — somebody who has not signed in. A guest is created the
//     moment they start a game, so this is not a refusal, it is *not yet*;
//   - **an anonymous session** — a guest. 4.3's design: a real `user` row so the
//     games they play follow them into an account. A guest has no pseudonym and
//     is not asked for one, because the row that would hold it is deleted the
//     moment they sign up;
//   - **an account** — which either has a pseudonym or is on its way to
//     `/choose-a-name` to pick one.
//
// Read on the server, every time, and never cached into a cookie. A pseudonym
// is claimed once and then true for ever, so the temptation is to remember it;
// what a stale copy buys is a player who is shown somebody else's name after a
// claim lost a race, and what it saves is one indexed read on a primary key.
import { selectPseudonym } from '@wikifake/db';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '../auth/auth.js';
import { db } from '../game/wiring.js';

/** Where an account with no pseudonym is sent, named once. */
export const CHOOSE_A_NAME = '/choose-a-name';

export interface Viewer {
  readonly kind: 'anonymous' | 'guest' | 'account';
  /** The account's id, for the two kinds that have one. */
  readonly userId?: string;
  /** What other players see. Only an account that has chosen one has this. */
  readonly pseudonym?: string;
}

/** Who is behind this request, and what they are called. */
export async function readViewer(): Promise<Viewer> {
  const session = await auth().api.getSession({ headers: await headers() });

  if (session === null) return { kind: 'anonymous' };
  if (session.user.isAnonymous === true) {
    return { kind: 'guest', userId: session.user.id };
  }

  const pseudonym = await selectPseudonym(db(), session.user.id);

  return {
    kind: 'account',
    userId: session.user.id,
    ...(pseudonym === null ? {} : { pseudonym: pseudonym.displayName }),
  };
}

/**
 * Lets a guest and a stranger through, and stops an account with no name.
 *
 * The guard the game screens use. It is deliberately *not* "you must have an
 * account": one of this effort's three conditions for done is a first-time
 * visitor who plays without signing up, and a gate that redirected everybody
 * without a pseudonym would end that on the day it shipped.
 */
export async function requirePseudonym(): Promise<Viewer> {
  const viewer = await readViewer();

  if (viewer.kind === 'account' && viewer.pseudonym === undefined) {
    redirect(CHOOSE_A_NAME);
  }

  return viewer;
}
