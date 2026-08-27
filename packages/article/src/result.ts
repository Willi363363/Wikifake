// Failure as a value.
//
// C3.7 — "Wikipedia not found → clean failure, no exception, no caching". A
// missing page is an ordinary outcome of asking about a topic a player typed, not
// an exceptional one, and the current code wraps three nested `try` blocks around
// that fact and then swallows everything with a bare `except Exception`.
//
// Reasons are a closed union so a caller can tell "this topic does not exist"
// from "Wikipedia is down" — the first means try another topic, the second means
// stop trying.
export type FailureReason =
  /** The page does not exist. Try another topic. */
  | 'not_found'
  /** The search returned nothing at all. */
  | 'no_results'
  /** The request never got an answer: DNS, timeout, connection. Stop trying. */
  | 'unreachable'
  /** Wikipedia answered with something this code does not understand. */
  | 'unexpected_response'
  /** Wikimedia asked us to slow down. */
  | 'rate_limited';

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: FailureReason; readonly detail: string };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function failed<T>(reason: FailureReason, detail: string): Result<T> {
  return { ok: false, reason, detail };
}
