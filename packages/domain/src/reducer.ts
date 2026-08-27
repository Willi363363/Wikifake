// The rules decide; they do not act.
//
// A reducer returns the new state and the effects to carry out — send this
// message, arm this timer — as plain data. Nothing here calls `setTimeout`,
// reads the clock or touches Redis: that is what makes a round-end-by-timeout
// testable without waiting five minutes, and what lets phase 5 wire the same
// effects onto BullMQ instead of a timer.

/** What a reducer returns: the state that follows, and what to carry out. */
export interface Reduced<S, E> {
  readonly state: S;
  readonly effects: readonly E[];
}

/** A rule: same state and same event in, same state and same effects out. */
export type Reducer<S, E, Ev> = (state: S, event: Ev) => Reduced<S, E>;

/** A transition that changes the state and asks for nothing. */
export function settle<S, E>(state: S): Reduced<S, E> {
  return { state, effects: [] };
}

/** A transition that changes the state and asks for something. */
export function emit<S, E>(state: S, ...effects: readonly E[]): Reduced<S, E> {
  return { state, effects };
}
