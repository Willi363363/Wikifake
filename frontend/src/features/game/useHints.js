/**
 * Paid hints.
 *
 * Le client ne détient plus la solution : chaque indice est demandé au
 * serveur, qui le facture puis renvoie son texte. Le transport diffère selon
 * le mode (WebSocket en multijoueur, REST en solo) mais le contrat est le
 * même — d'où le `requestHint` injecté.
 *
 * Le niveau est monotone : un joueur qui a payé le niveau 2 ne redescend pas
 * au tarif du niveau 1.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { playSound } from '../../lib/sound.js';
import { tokenIdFor } from '../../lib/article.js';
import { SCORING } from '../../config.js';

const costOf = (level) => (level >= 2 ? SCORING.revealCost : level === 1 ? SCORING.hintCost : 0);

/**
 * @param totalFakes  Nombre de cibles (le joueur sait combien, pas lesquelles).
 * @param requestHint (number, level) => void — envoie la demande au serveur.
 */
export function useHints(totalFakes, requestHint) {
  /** { numéro de cible: niveau payé } */
  const [levels, setLevels] = useState({});
  /** { numéro de cible: { hint, truth, paragraphIndex } } — reçu du serveur. */
  const [revealed, setRevealed] = useState({});

  // Une nouvelle manche remet le compteur à zéro.
  useEffect(() => {
    setLevels({});
    setRevealed({});
  }, [totalFakes]);

  const unlock = useCallback((number, level) => {
    playSound('hint');
    requestHint(number, level);
  }, [requestHint]);

  /** À appeler quand le serveur répond (`hint_unlocked` ou réponse REST). */
  const applyServerHint = useCallback((payload) => {
    if (!payload) return;
    const { number, level, hint, truth, paragraph_index: paragraphIndex } = payload;
    setLevels((prev) => ({ ...prev, [number]: Math.max(prev[number] || 0, level) }));
    setRevealed((prev) => ({
      ...prev,
      [number]: {
        hint: hint ?? prev[number]?.hint,
        truth: truth ?? prev[number]?.truth,
        paragraphIndex: paragraphIndex ?? prev[number]?.paragraphIndex,
      },
    }));
  }, []);

  /**
   * Tokens à mettre en évidence : uniquement ceux dont le serveur a livré la
   * position (niveau 2). Le niveau 1 donne un texte, pas un emplacement —
   * auparavant il surlignait le paragraphe, ce qui offrait la réponse au
   * tarif de l'indice.
   */
  const hintedTokenIds = useMemo(() => {
    const ids = new Set();
    for (const entry of Object.values(revealed)) {
      if (entry?.paragraphIndex) ids.add(tokenIdFor(entry.paragraphIndex));
    }
    return ids;
  }, [revealed]);

  const hintsUsed = Object.values(levels).filter((level) => level > 0).length;
  const hintPenalty = Object.values(levels).reduce((total, level) => total + costOf(level), 0);

  return { levels, revealed, unlock, applyServerHint, hintedTokenIds, hintsUsed, hintPenalty };
}
