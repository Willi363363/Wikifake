/** @vitest-environment jsdom */

// Reading the viewer's outfit — H.6's hook, and the defect CI found in it.
//
// The whole of this file is one claim: **work started by this hook must not
// outlive the component that started it.** Aborting the fetch is necessary and
// not sufficient — `fetch` honours a signal, and the gap between a response
// resolving and the code acting on it does not.
//
// It reached CI as `ReferenceError: window is not defined`, reported as an
// unhandled error *while all 1,530 cases passed*. A green suite and a failing
// job is the worst way to be told, so the guard has a test of its own rather
// than being left to whichever suite happens to lose the race next.
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useOutfit, NOTHING_WORN } from './use-outfit.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const WORN = {
  marker: 'MARKER_VIOLET',
  markStyle: 'MARK_STYLE_BRACKET',
  frame: null,
  owned: ['MARKER_VIOLET'],
};

/**
 * A `fetch` whose answer arrives only when the test says so.
 *
 * `json` is a spy, and that is what makes the guard observable: it is the first
 * thing the hook does *after* the response resolves, so a continuation that ran
 * past unmount has called it and one that stopped has not. Asserting on the
 * abort flag alone would be asserting that `abort()` was called — which was
 * already true when the defect shipped.
 */
function deferred() {
  let release: (value: unknown) => void = () => undefined;
  const answered = new Promise<unknown>((resolve) => {
    release = resolve;
  });
  const json = vi.fn(() => Promise.resolve(WORN));

  const call = vi.fn(
    (_input: unknown, _init?: RequestInit) =>
      answered.then(() => ({
        ok: true,
        status: 200,
        json,
      })) as unknown as Promise<Response>,
  );

  return { call, json, release: () => release(undefined) };
}

describe('H.6 — reading the outfit', () => {
  it('asks once, and only when there is a round to draw', async () => {
    const { call, release } = deferred();
    vi.stubGlobal('fetch', call);

    const { result, rerender } = renderHook(({ when }) => useOutfit(when), {
      initialProps: { when: false },
    });
    expect(call).not.toHaveBeenCalled();
    expect(result.current).toEqual(NOTHING_WORN);

    rerender({ when: true });
    await act(async () => {
      release();
    });

    expect(call).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({
      marker: 'MARKER_VIOLET',
      markStyle: 'MARK_STYLE_BRACKET',
    });
  });

  it('does no work at all with an answer that arrives after unmount', async () => {
    // The defect, and the assertion that actually catches it: `json` is never
    // read. The component is gone before the response resolves, so the
    // continuation must stop — in a browser that is a wasted render, and in a
    // test it is work outliving the environment, which is how this reached CI
    // as an unhandled `window is not defined`.
    const { call, json, release } = deferred();
    vi.stubGlobal('fetch', call);

    const { unmount } = renderHook(() => useOutfit(true));
    unmount();

    await act(async () => {
      release();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(json).not.toHaveBeenCalled();
  });

  it('does read the answer when the component is still there', async () => {
    // The other half: a guard that stopped everything would pass the test above
    // and break the feature.
    const { call, json, release } = deferred();
    vi.stubGlobal('fetch', call);

    renderHook(() => useOutfit(true));
    await act(async () => {
      release();
    });

    expect(json).toHaveBeenCalledTimes(1);
  });

  it('aborts the request as well as ignoring the answer', async () => {
    // Both halves. Aborting alone left the gap this test's sibling covers;
    // ignoring alone would leave a request running for a page nobody is on.
    const call = vi.fn(
      (_input: unknown, _init?: RequestInit) => new Promise<Response>(() => undefined),
    );
    vi.stubGlobal('fetch', call);

    const { unmount } = renderHook(() => useOutfit(true));
    const init = call.mock.calls[0]?.[1];
    expect(init?.signal?.aborted).toBe(false);

    unmount();

    expect(init?.signal?.aborted).toBe(true);
  });

  it('keeps the default when the server refuses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({}),
          }) as unknown as Promise<Response>,
      ),
    );

    const { result } = renderHook(() => useOutfit(true));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toEqual(NOTHING_WORN);
  });

  it('keeps the default when the body cannot be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ marker: 7 }),
          }) as unknown as Promise<Response>,
      ),
    );

    const { result } = renderHook(() => useOutfit(true));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toEqual(NOTHING_WORN);
  });

  it('says nothing when the server cannot be reached', async () => {
    // A round is not worth an error message about a cosmetic: the player sees
    // the marks they always had.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );

    const { result } = renderHook(() => useOutfit(true));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toEqual(NOTHING_WORN);
  });
});
