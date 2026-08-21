/**
 * Selection de paragraphes par le joueur.
 *
 * Un seul etat (`Set` d'indices 1-base) plus des notes optionnelles.
 * L'ancien code maintenait deux objets paralleles (`marked` et `edited`)
 * dont un seul etait transmis au serveur.
 */

import { useCallback, useMemo, useState } from 'react';

import { playSound } from '@/lib/sound';

export function useSelection() {
  const [selected, setSelected] = useState(() => new Set());
  const [notes, setNotes] = useState({});

  const toggle = useCallback((index) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
        playSound('click_off');
      } else {
        next.add(index);
        playSound('click_on');
      }
      return next;
    });
  }, []);

  const setNote = useCallback((index, value) => {
    setNotes((prev) => {
      if (value == null) {
        const { [index]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [index]: value };
    });
  }, []);

  const reset = useCallback(() => {
    setSelected(new Set());
    setNotes({});
  }, []);

  const indices = useMemo(() => [...selected].sort((a, b) => a - b), [selected]);

  return { selected, indices, count: selected.size, toggle, notes, setNote, reset };
}
