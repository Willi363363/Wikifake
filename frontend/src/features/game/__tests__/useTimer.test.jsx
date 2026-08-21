import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTimer } from '../useTimer.js';

describe('useTimer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('décompte une fois par seconde', () => {
    const { result } = renderHook(() => useTimer(10, true));
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current[0]).toBe(7);
  });

  it('reste immobile à l’arrêt', () => {
    const { result } = renderHook(() => useTimer(10, false));
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current[0]).toBe(10);
  });

  it('ne descend jamais sous zéro', () => {
    const { result } = renderHook(() => useTimer(2, true));
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current[0]).toBe(0);
  });

  it('laisse un item retirer des secondes', () => {
    const { result } = renderHook(() => useTimer(60, true));
    act(() => result.current[1]((previous) => previous - 10));
    expect(result.current[0]).toBe(50);
  });
});
