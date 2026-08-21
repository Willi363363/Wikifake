import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSelection } from '../useSelection.js';

describe('useSelection', () => {
  it('convertit les identifiants de token en index 1-base', () => {
    const { result } = renderHook(() => useSelection('normal', false));
    act(() => result.current.onTokenClick('p0'));
    act(() => result.current.onTokenClick('p4'));

    // C'est la convention attendue par le backend sur submit_answer.
    expect(result.current.answerIndices.sort((a, b) => a - b)).toEqual([1, 5]);
  });

  it('bascule un token', () => {
    const { result } = renderHook(() => useSelection('normal', false));
    act(() => result.current.onTokenClick('p2'));
    expect(result.current.markedCount).toBe(1);
    act(() => result.current.onTokenClick('p2'));
    expect(result.current.markedCount).toBe(0);
  });

  it('ne réagit plus quand la manche est verrouillée', () => {
    const { result } = renderHook(() => useSelection('normal', true));
    act(() => result.current.onTokenClick('p1'));
    expect(result.current.markedCount).toBe(0);
  });

  it('en mode expert, enregistre une correction au lieu d’une coche', () => {
    const { result } = renderHook(() => useSelection('expert', false));
    act(() => result.current.onTokenClick('p1'));
    expect(result.current.edited).toHaveProperty('p1', '');

    act(() => result.current.onTokenEdit('p1', '1887'));
    expect(result.current.edited.p1).toBe('1887');
  });

  it('efface une correction', () => {
    const { result } = renderHook(() => useSelection('expert', false));
    act(() => result.current.onTokenClick('p1'));
    act(() => result.current.onTokenEdit('p1', null));
    expect(result.current.edited).not.toHaveProperty('p1');
  });
});
