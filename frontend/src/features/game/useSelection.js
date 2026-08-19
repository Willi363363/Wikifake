/**
 * Tracks which tokens the player has marked as suspect.
 *
 * Normal mode records a boolean per token; expert mode records the corrected
 * value the player typed. Both are kept because a player can switch modes
 * mid-round and we must not lose either kind of answer.
 */
import { useState, useCallback, useMemo } from 'react';
import { playSound } from '../../lib/sound.js';

export function useSelection(mode, locked) {
  const [marked, setMarked] = useState({});
  const [edited, setEdited] = useState({});

  const onTokenClick = useCallback((id) => {
    if (locked) return;

    if (mode === 'expert') {
      setEdited((prev) => {
        if (prev[id] !== undefined && prev[id] !== null) {
          playSound('click_off');
          const { [id]: _removed, ...rest } = prev;
          return rest;
        }
        playSound('click_on');
        return { ...prev, [id]: '' };
      });
      return;
    }

    setMarked((prev) => {
      const next = { ...prev };
      if (next[id]) {
        playSound('click_off');
        delete next[id];
      } else {
        playSound('click_on');
        next[id] = true;
      }
      return next;
    });
  }, [mode, locked]);

  const onTokenEdit = useCallback((id, value) => {
    setEdited((prev) => {
      if (value === null) {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: value };
    });
  }, []);

  const markedCount = Object.keys(marked).length + Object.keys(edited).length;

  /** Paragraph indices, 1-based, as the backend expects them on submit. */
  const answerIndices = useMemo(
    () => Object.keys(marked).map((key) => parseInt(key.substring(1), 10) + 1),
    [marked],
  );

  return { marked, edited, onTokenClick, onTokenEdit, markedCount, answerIndices };
}
