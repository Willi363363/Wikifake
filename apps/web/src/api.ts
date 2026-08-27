// One way to POST, and one way to read what came back.
//
// Extracted from `solo/api.ts` when the flag report of 8.8 became the second
// caller: how a refusal is read — its sentence, its code, the body that is not
// JSON at all — is a decision, and two copies of it are two answers to the same
// question.
import { decode, restError, type ErrorCode } from '@wikifake/protocol';

/**
 * What the server said, or why it could not be believed.
 *
 * A refusal carries its `code` as well as its sentence, because some of them are
 * a state and not just a message: `hints_blocked` means a rival has jammed the
 * intel and nothing was charged, which the screen has to show differently from
 * "that did not work". The code is `null` when the refusal did not come from the
 * game — a proxy, a network, a body that is not JSON.
 */
export type Answer<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string; readonly code: ErrorCode | null };

const UNREACHABLE = 'the server could not be reached';
/** Every caller decodes what came back, and this is what they say when it fails. */
export const UNREADABLE = 'the server answered something we cannot read';
const REFUSED = 'the server refused the request';

/** A POST, its body, and the refusal path. Never throws. */
export async function post(path: string, body: unknown): Promise<Answer<unknown>> {
  let answer: Response;
  try {
    answer = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: UNREACHABLE, code: null };
  }

  // Read before the status is looked at: a refusal carries its reason in the
  // same body a success would have used.
  let payload: unknown = null;
  try {
    payload = await answer.json();
  } catch {
    payload = null;
  }

  if (!answer.ok) {
    const said = decode(restError, payload);
    return said.ok
      ? { ok: false, message: said.value.message, code: said.value.code }
      : { ok: false, message: REFUSED, code: null };
  }
  return { ok: true, value: payload };
}
