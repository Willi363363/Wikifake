/**
 * Effets visuels actifs.
 *
 * Un seul etat au lieu de onze booleens (`blurActive`, `spinActive`, ...)
 * chacun avec son `setTimeout` en dur. La duree vient du catalogue partage.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { getItemDef } from '@/config/items';

export function useVisualEffects() {
  const [active, setActive] = useState({});
  const timers = useRef(new Map());

  const clearTimer = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  /** Active un effet pour la duree declaree dans `shared/items.json`. */
  const trigger = useCallback(
    (itemId, overrideMs) => {
      const duration = overrideMs ?? getItemDef(itemId).durationMs;
      clearTimer(itemId);
      setActive((prev) => ({ ...prev, [itemId]: true }));
      if (duration > 0) {
        const timer = setTimeout(() => {
          setActive((prev) => {
            const { [itemId]: _done, ...rest } = prev;
            return rest;
          });
          timers.current.delete(itemId);
        }, duration);
        timers.current.set(itemId, timer);
      }
    },
    [clearTimer],
  );

  /** Coupe un effet sans duree (ex. pop-up ferme par le joueur). */
  const dismiss = useCallback(
    (itemId) => {
      clearTimer(itemId);
      setActive((prev) => {
        const { [itemId]: _done, ...rest } = prev;
        return rest;
      });
    },
    [clearTimer],
  );

  const clearAll = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    setActive({});
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const isActive = useCallback((itemId) => Boolean(active[itemId]), [active]);

  return { active, isActive, trigger, dismiss, clearAll };
}
