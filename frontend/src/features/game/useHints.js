/**
 * Paid hints.
 *
 * En multijoueur, le déverrouillage passe par le serveur : c'est lui qui
 * facture (`unlock_hint` → `hint_unlocked`) et qui détient le texte de
 * l'indice. Le client ne peut donc plus effacer sa pénalité, et n'a plus la
 * réponse sous la main avant de l'avoir payée.
 *
 * En solo il n'y a personne à berner : le déverrouillage reste local, avec le
 * même barème (`SCORING`).
 *
 * Le niveau est monotone — un joueur qui a payé le niveau 2 ne redescend pas
 * au tarif du niveau 1.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { playSound } from '../../lib/sound.js';
import { send, useSocketMessages } from '../../lib/ws.js';
import { SCORING } from '../../config.js';

const costOf = (level) =>
  level >= 2 ? SCORING.revealCost : level === 1 ? SCORING.hintCost : 0;

export function useHints(fakes, socket = null) {
  const [unlocks, setUnlocks] = useState({});
  /** Textes reçus du serveur, par numéro de fausse information. */
  const [revealed, setRevealed] = useState({});

  // Une nouvelle manche remet le compteur à zéro.
  useEffect(() => {
    setUnlocks({});
    setRevealed({});
  }, [fakes]);

  const unlock = useCallback((fakeId, level) => {
    playSound('hint');
    if (socket) {
      // `fakeId` vaut "F<index>" ; le serveur numérote les fausses infos à
      // partir de 1, dans l'ordre d'apparition.
      const number = Number(String(fakeId).replace(/^F/, '')) + 1;
      send(socket, 'unlock_hint', { number, level });
      return;
    }
    setUnlocks((prev) => ({ ...prev, [fakeId]: Math.max(prev[fakeId] || 0, level) }));
  }, [socket]);

  useSocketMessages(socket, (msg) => {
    if (msg.type !== 'hint_unlocked') return;
    const fakeId = `F${msg.number - 1}`;
    setUnlocks((prev) => ({ ...prev, [fakeId]: Math.max(prev[fakeId] || 0, msg.level) }));
    setRevealed((prev) => ({
      ...prev,
      [fakeId]: { hint: msg.hint, truth: msg.truth ?? prev[fakeId]?.truth },
    }));
  });

  /** Tokens whose hint has been bought, so the article can highlight them. */
  const hintedTokenIds = useMemo(() => {
    const ids = new Set();
    for (const fake of fakes) {
      if ((unlocks[fake.id] || 0) >= 1) ids.add(fake.tokenId);
    }
    return ids;
  }, [unlocks, fakes]);

  const hintsUsed = Object.values(unlocks).filter((level) => level > 0).length;
  const hintPenalty = Object.values(unlocks).reduce((total, level) => total + costOf(level), 0);

  return { unlocks, unlock, revealed, hintedTokenIds, hintsUsed, hintPenalty };
}
