/**
 * The round countdown.
 *
 * `setTime` is exposed because items can steal seconds from the clock; the
 * countdown itself never pauses, which is what the original game did.
 */
import { useState, useEffect } from 'react';

export function useTimer(initialSeconds, running) {
  const [time, setTime] = useState(initialSeconds);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setTime((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  return [time, setTime];
}
