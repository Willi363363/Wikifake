// `GET /api/account/export` and `POST /api/account/delete` — step E.7.
//
// Two rights, one file, because they are one obligation and their answers are
// each other's opposite: one hands the account's data over, the other takes it
// away. Getting the second wrong is unrecoverable, so it is worth reading the
// two side by side.
//
// **An export is the one route this application has that hands a player's
// history to a browser**, which E.5 deliberately avoided by rendering the
// profile on the server. It is the necessary exception, and it is narrow: the
// id it reads is the session's own, there is no parameter to get an
// authorisation check wrong on, and nothing here can be asked about somebody
// else.
//
// **A guest has neither right here.** Not because they have no data — they have
// rounds — but because a guest is not an account: there is nobody to
// authenticate as, and an anonymous session that could delete "its" rows is a
// deletion anybody's browser could perform on whatever it happened to be
// holding. What a guest's data does is follow them into an account, which is
// 4.3's design, and then these two apply.
import { deleteAccount, exportAccount, type Database } from '@wikifake/db';
import { MAX_PLAYER_NAME_LENGTH } from '@wikifake/protocol';

import type { auth } from '../auth/auth.js';
import { refuse } from '../game/errors.js';

export interface AccountDataContext {
  readonly auth: ReturnType<typeof auth>;
  readonly db: Database['db'];
  /**
   * The name a deleted account's rounds are attributed to.
   *
   * Injected so a test can pin it, and so the rule about what a name may look
   * like stays in the layer that owns `playerName`. `deletedPlayerName` is the
   * production one.
   */
  readonly placeholder: () => string;
}

/**
 * A name for somebody who is no longer here.
 *
 * **Random, and one per deletion.** A fixed string would show two deleted
 * players in one room under the same name, which is a debrief that reads as one
 * person having played twice. A hash of the id would be stable — and stable is
 * exactly what a deleted account must not be, because the same placeholder
 * appearing in two rooms says those were the same person.
 *
 * Shaped to pass `playerName`: the column is rendered in a debrief and read by
 * `selectGameHistory`, so a placeholder no room could have shown is a row the
 * rest of the application has to learn about.
 */
export function deletedPlayerName(): string {
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  const suffix = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const name = `deleted-${suffix}`;

  // A guard rather than a comment: `MAX_PLAYER_NAME_LENGTH` is the protocol's
  // and this is the only place that could quietly outgrow it.
  return name.slice(0, MAX_PLAYER_NAME_LENGTH);
}

/** The account behind this request, or null when there is no account. */
async function accountOf(
  context: AccountDataContext,
  request: Request,
): Promise<string | null> {
  const session = await context.auth.api.getSession({ headers: request.headers });
  if (session === null || session.user.isAnonymous === true) return null;
  return session.user.id;
}

export async function handleExport(
  context: AccountDataContext,
  request: Request,
): Promise<Response> {
  const userId = await accountOf(context, request);
  if (userId === null) {
    return refuse('session_not_found', 'Sign in to export your data.');
  }

  const taken = await exportAccount(context.db, userId);
  // A session naming a row that is not there. Not reachable through the front
  // door, and answering 200 with nothing would be the wrong shape to debug.
  if (taken === null) {
    return refuse('session_not_found', 'That account no longer exists.');
  }

  // Not through `json` from `respond.ts`, and that is deliberate: an export is
  // not a contract two ends agreed on, it is *everything we hold*, and encoding
  // it through a schema would silently drop the first column somebody adds
  // without updating the schema — which is the one failure an export must not
  // have.
  return new Response(JSON.stringify(taken, null, 2), {
    headers: {
      'content-type': 'application/json',
      // A file rather than a page. The name carries no id and no address: it
      // lands in a downloads folder, which is not a private place.
      'content-disposition': 'attachment; filename="wikifake-account.json"',
      // Never stored by anything between here and the player.
      'cache-control': 'no-store',
    },
  });
}

export async function handleDelete(
  context: AccountDataContext,
  request: Request,
): Promise<Response> {
  const userId = await accountOf(context, request);
  if (userId === null) {
    return refuse('session_not_found', 'Sign in to delete your account.');
  }

  // One transaction: an anonymisation that committed without its delete would
  // be an account whose rounds had been stripped of their name and which still
  // existed — the worst of both.
  const deletion = await context.db.transaction((tx) =>
    deleteAccount(tx, userId, context.placeholder()),
  );

  // The session rows went with the account — `session.user_id` cascades — so
  // the cookie in the browser now names nothing. Cleared anyway, because a
  // cookie that resolves to no session is a browser that looks signed in until
  // it asks.
  return new Response(JSON.stringify(deletion), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}
