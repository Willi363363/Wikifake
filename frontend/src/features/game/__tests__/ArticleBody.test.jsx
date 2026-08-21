import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ArticleBody from '../ArticleBody';

const PARAGRAPHS = [
  { index: 1, text: 'Premier paragraphe.' },
  { index: 2, text: 'Deuxième paragraphe.' },
  { index: 3, text: 'Troisième paragraphe.' },
];

function setup(overrides = {}) {
  const onToggle = vi.fn();
  render(
    <ArticleBody
      paragraphs={PARAGRAPHS}
      selected={new Set()}
      notes={{}}
      noteMode={false}
      hintedIndices={new Set()}
      scannedIndices={new Set()}
      solutionIndices={new Set()}
      revealed={false}
      onToggle={onToggle}
      onNoteChange={vi.fn()}
      {...overrides}
    />,
  );
  return { onToggle };
}

describe('ArticleBody', () => {
  it('rend un paragraphe cliquable par index 1-base', async () => {
    const { onToggle } = setup();
    await userEvent.click(screen.getByLabelText('Paragraphe 2'));
    expect(onToggle).toHaveBeenCalledWith(2);
  });

  it('est utilisable au clavier', async () => {
    const { onToggle } = setup();
    screen.getByLabelText('Paragraphe 1').focus();
    await userEvent.keyboard('{Enter}');
    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it('expose l’état sélectionné via aria-pressed', () => {
    setup({ selected: new Set([3]) });
    expect(screen.getByLabelText('Paragraphe 3')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Paragraphe 1')).toHaveAttribute('aria-pressed', 'false');
  });

  it('classe les paragraphes après révélation', () => {
    setup({
      revealed: true,
      selected: new Set([1, 2]),
      solutionIndices: new Set([2, 3]),
    });
    expect(screen.getByLabelText('Paragraphe 2').className).toContain('found');
    expect(screen.getByLabelText('Paragraphe 3').className).toContain('missed');
    expect(screen.getByLabelText('Paragraphe 1').className).toContain('false-positive');
  });

  it('ne réagit plus aux clics après révélation', async () => {
    const { onToggle } = setup({ revealed: true });
    await userEvent.click(screen.getByLabelText('Paragraphe 1'));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
