// The room's chat, as a list with a floor under it.
//
// The current panel keeps `messages` unbounded: a room left open for an hour
// with one talkative player is an array that only grows, re-rendered in full on
// every line. Nothing breaks — it just gets slower for as long as the room
// lives, which is the shape of problem nobody reports and everybody feels.
//
// A cap is not history management. It is a scrollback: the oldest lines fall off
// the top, exactly as a terminal's do.

/** One line, as `chat_message` carries it. */
export interface ChatLine {
  readonly sender: string;
  readonly content: string;
}

/**
 * How many lines are kept.
 *
 * Two hundred is more than a round produces and far more than anyone scrolls
 * back through. The number matters less than there being one.
 */
export const MAX_LINES = 200;

/** The log with one more line, and never longer than the cap. */
export function appended(log: readonly ChatLine[], line: ChatLine): readonly ChatLine[] {
  const grown = [...log, line];
  return grown.length <= MAX_LINES ? grown : grown.slice(grown.length - MAX_LINES);
}
