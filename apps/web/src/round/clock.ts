// The round's clock, as arithmetic.
//
// Two things the current top bar decides inline: how the time reads, and when it
// starts looking like a problem. Both are pure, both are worth a test, and
// neither wants to be re-derived by the next screen that shows a countdown.

/** Under a minute and a half the clock warns; under thirty seconds it insists. */
export const WARNING_SECONDS = 90;
export const URGENT_SECONDS = 30;

/** `mm:ss`, zero-padded. A bare count of seconds is not read as time. */
export function asClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return `${String(minutes).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export type Pressure = 'calm' | 'warning' | 'urgent';

/**
 * How the remaining time should read.
 *
 * Returned as a name rather than a colour: the colour is the theme's business,
 * and a component that receives `'urgent'` can also say the word out loud, which
 * a red hex value cannot.
 */
export function pressureAt(seconds: number): Pressure {
  if (seconds <= URGENT_SECONDS) return 'urgent';
  if (seconds <= WARNING_SECONDS) return 'warning';
  return 'calm';
}
