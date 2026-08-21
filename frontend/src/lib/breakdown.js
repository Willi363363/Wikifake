/**
 * Normalisation du detail de score renvoye par le serveur.
 *
 * IMPORTANT : le client ne recalcule plus aucun score. Il affiche les
 * nombres que le backend a calcules (`app/rooms/scoring.py`). C'est ce qui
 * elimine la quadruple formule de l'ancienne version.
 */

const EMPTY = {
  hits: 0,
  falsePositives: 0,
  missed: 0,
  basePoints: 0,
  falsePositivePenalty: 0,
  hintsUsed: 0,
  hintPenalty: 0,
  stolenPoints: 0,
  timeBonus: 0,
  total: 0,
};

/** `snake_case` serveur -> `camelCase` composant. */
export function normalizeBreakdown(raw) {
  if (!raw) return { ...EMPTY };
  return {
    hits: raw.hits ?? 0,
    falsePositives: raw.false_positives ?? 0,
    missed: raw.missed ?? 0,
    basePoints: raw.base_points ?? 0,
    falsePositivePenalty: raw.false_positive_penalty ?? 0,
    hintsUsed: raw.hints_used ?? 0,
    hintPenalty: raw.hint_penalty ?? 0,
    stolenPoints: raw.stolen_points ?? 0,
    timeBonus: raw.time_bonus ?? 0,
    total: raw.total ?? 0,
  };
}

/** Score cumule apres `stage` etapes (0 = rien de revele). */
export function scoreAtStage(breakdown, stage) {
  const b = normalizeBreakdown(breakdown);
  let score = 0;
  if (stage >= 1) score += b.basePoints;
  if (stage >= 2) score -= b.falsePositivePenalty;
  if (stage >= 3) score -= b.hintPenalty + b.stolenPoints;
  if (stage >= 4) score += b.timeBonus;
  return stage >= 5 ? b.total : score;
}

/** Variation affichee a l'etape `stage`. */
export function stageDelta(breakdown, stage) {
  const b = normalizeBreakdown(breakdown);
  switch (stage) {
    case 1:
      return { value: `+${b.basePoints}`, color: 'var(--green)' };
    case 2:
      return b.falsePositivePenalty > 0
        ? { value: `−${b.falsePositivePenalty}`, color: 'var(--danger)' }
        : { value: '±0', color: 'var(--muted)' };
    case 3: {
      const malus = b.hintPenalty + b.stolenPoints;
      return malus > 0
        ? { value: `−${malus}`, color: 'var(--bronze)' }
        : { value: '±0', color: 'var(--muted)' };
    }
    case 4:
      return { value: `+${b.timeBonus}`, color: 'var(--green)' };
    default:
      return { value: '', color: 'var(--muted)' };
  }
}

/** Qualite globale (0-1) : sert a attribuer une mention au debrief. */
export function accuracyScore(breakdown, totalFakes) {
  const b = normalizeBreakdown(breakdown);
  const precision = b.hits + b.falsePositives === 0 ? 0 : b.hits / (b.hits + b.falsePositives);
  const recall = totalFakes === 0 ? 0 : b.hits / totalFakes;
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}
