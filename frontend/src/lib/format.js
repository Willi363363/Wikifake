/** Formatage partage (chrono, scores, pluriels). */

export function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, '0');
  const seconds = String(safe % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function formatDuration(seconds) {
  return seconds < 60 ? `${seconds}s` : `${(seconds / 60).toFixed(1)}min`;
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return count > 1 ? pluralForm : singular;
}

export function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}
