/** Presentation des verdicts renvoyes par le verificateur automatique. */

export const VERDICT_STYLES = {
  likely_valid: { text: '#166534', bg: '#dcfce7', label: 'Probablement valide', icon: '✅' },
  uncertain: { text: '#92400e', bg: '#fef3c7', label: 'Incertain', icon: '⚠️' },
  unsupported: { text: '#991b1b', bg: '#fee2e2', label: 'Non etaye', icon: '❌' },
};

export function verdictStyle(verdict) {
  return VERDICT_STYLES[verdict] ?? VERDICT_STYLES.uncertain;
}
