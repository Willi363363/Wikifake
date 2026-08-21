import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SCORING } from '../../../config.js';
import { useHints } from '../useHints.js';

function setup(totalFakes = 3) {
  const requestHint = vi.fn();
  const view = renderHook(() => useHints(totalFakes, requestHint));
  return { requestHint, ...view };
}

describe('useHints', () => {
  it('délègue la demande au serveur sans rien décider', () => {
    const { requestHint, result } = setup();
    act(() => result.current.unlock(2, 1));

    expect(requestHint).toHaveBeenCalledWith(2, 1);
    // Rien n'est débloqué avant la réponse : c'est le serveur qui facture.
    expect(result.current.levels).toEqual({});
    expect(result.current.hintPenalty).toBe(0);
  });

  it('applique la réponse du serveur', () => {
    const { result } = setup();
    act(() => result.current.applyServerHint({ number: 1, level: 1, hint: 'La date.' }));

    expect(result.current.levels).toEqual({ 1: 1 });
    expect(result.current.revealed[1].hint).toBe('La date.');
    expect(result.current.hintsUsed).toBe(1);
    expect(result.current.hintPenalty).toBe(SCORING.hintCost);
  });

  it('facture la révélation au tarif du niveau 2', () => {
    const { result } = setup();
    act(() => result.current.applyServerHint({
      number: 1, level: 2, hint: 'La date.', truth: 'En réalité 1887.', paragraph_index: 2,
    }));

    expect(result.current.hintPenalty).toBe(SCORING.revealCost);
    expect(result.current.revealed[1].truth).toBe('En réalité 1887.');
  });

  it('est monotone : redescendre au niveau 1 ne rembourse pas', () => {
    const { result } = setup();
    act(() => result.current.applyServerHint({ number: 1, level: 2, hint: 'h', truth: 'v', paragraph_index: 2 }));
    act(() => result.current.applyServerHint({ number: 1, level: 1, hint: 'h' }));

    expect(result.current.levels[1]).toBe(2);
    expect(result.current.hintPenalty).toBe(SCORING.revealCost);
  });

  it('ne compte qu’une fois la même cible', () => {
    const { result } = setup();
    act(() => result.current.applyServerHint({ number: 1, level: 1, hint: 'h' }));
    act(() => result.current.applyServerHint({ number: 1, level: 1, hint: 'h' }));
    expect(result.current.hintsUsed).toBe(1);
  });

  it('cumule plusieurs cibles', () => {
    const { result } = setup();
    act(() => result.current.applyServerHint({ number: 1, level: 1, hint: 'a' }));
    act(() => result.current.applyServerHint({ number: 2, level: 2, hint: 'b', truth: 'v', paragraph_index: 4 }));

    expect(result.current.hintsUsed).toBe(2);
    expect(result.current.hintPenalty).toBe(SCORING.hintCost + SCORING.revealCost);
  });

  it('ne surligne un paragraphe qu’au niveau 2', () => {
    const { result } = setup();
    act(() => result.current.applyServerHint({ number: 1, level: 1, hint: 'h' }));
    // Le niveau 1 donne un texte, pas un emplacement : il surlignait
    // auparavant le paragraphe, offrant la réponse au tarif de l'indice.
    expect(result.current.hintedTokenIds.size).toBe(0);

    act(() => result.current.applyServerHint({ number: 1, level: 2, hint: 'h', paragraph_index: 3 }));
    expect([...result.current.hintedTokenIds]).toEqual(['p2']);
  });

  it('ignore une réponse vide', () => {
    const { result } = setup();
    act(() => result.current.applyServerHint(null));
    expect(result.current.levels).toEqual({});
  });

  it('repart de zéro à la manche suivante', () => {
    const { result, rerender } = renderHook(({ total }) => useHints(total, () => {}), {
      initialProps: { total: 3 },
    });
    act(() => result.current.applyServerHint({ number: 1, level: 2, hint: 'h', paragraph_index: 2 }));
    expect(result.current.hintsUsed).toBe(1);

    rerender({ total: 4 });
    expect(result.current.hintsUsed).toBe(0);
    expect(result.current.revealed).toEqual({});
  });
});
