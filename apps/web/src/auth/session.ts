// Step O.6 — who is asking, read once a request.
//
// Every screen needs the answer and three different pieces of code were asking
// for it: `adminHere()` from the layout, which step L.5 put on **every** page so
// the bar can decide whether to render the admin entry; the page itself, where
// it needs the account; and `readViewer()`, called by that same page a line
// later. Measured on `/fr/profile` with `log_statement = all`: nine queries, of
// which **six** were the `session` row and the `user` row, read three times each
// with identical parameters, one after another. `/fr/shop` and `/fr/quests` were
// the same six. `09-query-debt.md` carries the table.
//
// On a loopback that is a millisecond apiece and invisible. Against Neon from a
// Vercel function it is four avoidable round trips on the critical path of every
// signed-in page, before the page's own data.
//
// **The fix is not to make anybody ask less.** Each of the three callers is
// right to want the answer, and a shared one passed down as a prop would be the
// same fact in two places — the duplication this repository already refuses for
// business rules. What was missing is that nothing memoised the question.
import { cache } from 'react';
import { headers } from 'next/headers';

import { auth } from './auth.js';

/**
 * The session behind this request, asked for at most once.
 *
 * React's `cache` is per render pass, which is exactly the scope wanted: two
 * requests never share an answer — the bug that a module-level variable would
 * be — and within one page the layout, the page and the viewer all get the same
 * one. It is the reason this is a function in its own file rather than a
 * variable anywhere.
 *
 * `auth()` already memoises the Better Auth instance, so what is saved here is
 * the round trip rather than the client.
 */
export const currentSession = cache(async () =>
  auth().api.getSession({ headers: await headers() }),
);

/** What `currentSession` answers, for callers that pass it on. */
export type CurrentSession = Awaited<ReturnType<typeof currentSession>>;
