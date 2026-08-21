/**
 * Chrono de partie.
 *
 * Le temps restant est derive de la duree serveur et des malus recus, pas
 * d'un `useState(180)` en dur desynchronise de la duree reelle (ancien bug :
 * `elapsed = GAME_DURATION - time` avec une constante figee a 300).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export function useGameClock({ durationS, running, onExpire }) {
  const [remaining, setRemaining] = useState(durationS);
  const expired = useRef(false);
  const expireCallback = useRef(onExpire);
  expireCallback.current = onExpire;

  useEffect(() => {
    setRemaining(durationS);
    expired.current = false;
  }, [durationS]);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (running && remaining === 0 && !expired.current) {
      expired.current = true;
      expireCallback.current?.();
    }
  }, [remaining, running]);

  /** Malus de temps (item FREEZE_TIME). */
  const subtract = useCallback((seconds) => {
    setRemaining((prev) => Math.max(0, prev - seconds));
  }, []);

  return { remaining, elapsed: Math.max(0, durationS - remaining), subtract };
}
