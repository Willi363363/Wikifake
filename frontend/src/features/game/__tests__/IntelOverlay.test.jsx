import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IntelOverlay } from '../IntelOverlay.jsx';
import { hintTargets } from '../../../lib/article.js';

function setup({ unlocked = {}, revealed = {} } = {}) {
  const onUnlock = vi.fn();
  render(
    <IntelOverlay
      open
      onClose={() => {}}
      targets={hintTargets(2)}
      unlocked={unlocked}
      revealed={revealed}
      onUnlock={onUnlock}
    />,
  );
  return { onUnlock };
}

describe('IntelOverlay', () => {
  it('ne montre rien tant qu’aucun indice n’est payé', () => {
    setup();
    // Les cibles sont numérotées, jamais localisées.
    expect(screen.getByText(/Cible #01/)).toBeInTheDocument();
    expect(screen.getByText(/Cible #02/)).toBeInTheDocument();
    expect(screen.getAllByText(/▒▒▒/)).toHaveLength(2);
  });

  it('demande l’indice au numéro de cible', async () => {
    const { onUnlock } = setup();
    await userEvent.click(screen.getAllByRole('button', { name: 'Indice' })[0]);
    expect(onUnlock).toHaveBeenCalledWith(1, 1);
  });

  it('demande la révélation au niveau 2', async () => {
    const { onUnlock } = setup();
    await userEvent.click(screen.getAllByRole('button', { name: 'Révéler' })[1]);
    expect(onUnlock).toHaveBeenCalledWith(2, 2);
  });

  it('affiche le texte livré par le serveur', () => {
    setup({ unlocked: { 1: 1 }, revealed: { 1: { hint: 'Vérifiez la date.' } } });
    expect(screen.getByText('Vérifiez la date.')).toBeInTheDocument();
    expect(screen.getAllByText(/▒▒▒/)).toHaveLength(1);
  });

  it('affiche la vérité au niveau 2', () => {
    setup({
      unlocked: { 1: 2 },
      revealed: { 1: { hint: 'Vérifiez la date.', truth: 'En réalité 1887.' } },
    });
    expect(screen.getByText(/En réalité 1887/)).toBeInTheDocument();
  });

  it('ne rend rien quand il est fermé', () => {
    const { container } = render(
      <IntelOverlay open={false} onClose={() => {}} targets={hintTargets(2)} unlocked={{}} onUnlock={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
