// What the browser sends to claim a pseudonym — step E.3.2.
//
// A module of its own, and small on purpose. Both account forms make this one
// call and do entirely different things with the answer, so what they share is
// a *function* rather than a component — and putting it here keeps the sign-up
// form from importing the choose-a-name form to get at it.
//
// Not in `client.ts`, which is Better Auth's half of the browser: this endpoint
// is ours, and the two have no reason to be replaced together in a test.
import { accountApi, decode, restError } from '@wikifake/protocol';

export type Claimed =
  | { readonly ok: true; readonly pseudonym: string }
  | { readonly ok: false; readonly message: string | null };

/**
 * Claims a pseudonym, and says what came back.
 *
 * `{ ok: false, message: null }` is how it says *I have no sentence for this*,
 * and the caller supplies its own. Every other refusal carries the server's,
 * which is the better one.
 */
export async function claim(pseudonym: string): Promise<Claimed> {
  const answer = await fetch('/api/account/pseudonym', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pseudonym }),
  });

  const body: unknown = await answer.json().catch(() => null);

  if (answer.ok) {
    const read = decode(accountApi.claimPseudonymResponse, body);
    // A 200 whose body is not the contract is a broken deployment, not a taken
    // name. `message: null` is how this function says *I have no sentence for
    // this*, and the caller supplies its own.
    return read.ok
      ? { ok: true, pseudonym: read.value.pseudonym }
      : { ok: false, message: null };
  }

  const refusal = decode(restError, body);
  return { ok: false, message: refusal.ok ? refusal.value.message : null };
}
