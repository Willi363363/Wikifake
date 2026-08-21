import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVisualEffects } from '../useVisualEffects';
import { getItemDef } from '@/config/items';

describe('useVisualEffects', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("s'éteint tout seul après la durée déclarée dans shared/items.json", () => {
    const { result } = renderHook(() => useVisualEffects());
    const duration = getItemDef('BLUR').durationMs;

    act(() => result.current.trigger('BLUR'));
    expect(result.current.isActive('BLUR')).toBe(true);

    act(() => vi.advanceTimersByTime(duration - 10));
    expect(result.current.isActive('BLUR')).toBe(true);

    act(() => vi.advanceTimersByTime(20));
    expect(result.current.isActive('BLUR')).toBe(false);
  });

  it('reste actif pour un effet sans durée (fermeture manuelle)', () => {
    const { result } = renderHook(() => useVisualEffects());
    act(() => result.current.trigger('RICKROLL'));
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.isActive('RICKROLL')).toBe(true);
    act(() => result.current.dismiss('RICKROLL'));
    expect(result.current.isActive('RICKROLL')).toBe(false);
  });

  it('relance le minuteur si l’effet est réappliqué', () => {
    const { result } = renderHook(() => useVisualEffects());
    const duration = getItemDef('SPIN').durationMs;
    act(() => result.current.trigger('SPIN'));
    act(() => vi.advanceTimersByTime(duration - 100));
    act(() => result.current.trigger('SPIN'));
    act(() => vi.advanceTimersByTime(duration - 100));
    expect(result.current.isActive('SPIN')).toBe(true);
  });

  it('cumule plusieurs effets', () => {
    const { result } = renderHook(() => useVisualEffects());
    act(() => {
      result.current.trigger('BLUR');
    });
    act(() => {
      result.current.trigger('INVERT');
    });
    expect(Object.keys(result.current.active).sort()).toEqual(['BLUR', 'INVERT']);
  });
});
