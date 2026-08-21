import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSelection } from '../useSelection';

describe('useSelection', () => {
  it('bascule un paragraphe', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.toggle(3));
    expect(result.current.indices).toEqual([3]);
    act(() => result.current.toggle(3));
    expect(result.current.indices).toEqual([]);
  });

  it('renvoie des indices triés', () => {
    const { result } = renderHook(() => useSelection());
    act(() => {
      result.current.toggle(5);
    });
    act(() => {
      result.current.toggle(2);
    });
    expect(result.current.indices).toEqual([2, 5]);
    expect(result.current.count).toBe(2);
  });

  it('gère les notes de correction', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.setNote(2, '1789'));
    expect(result.current.notes[2]).toBe('1789');
    act(() => result.current.setNote(2, null));
    expect(result.current.notes[2]).toBeUndefined();
  });

  it('se réinitialise', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.toggle(1));
    act(() => result.current.setNote(1, 'x'));
    act(() => result.current.reset());
    expect(result.current.count).toBe(0);
    expect(result.current.notes).toEqual({});
  });
});
