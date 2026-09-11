'use client';

// What the viewer is wearing, for a client screen — step H.6.
//
// The solo round is a client component all the way down: it reads the topic out
// of the query string, so Next cannot prerender it and there is no server
// component above it to hand an outfit down. So the outfit is fetched.
//
// **Read once, and never again.** An outfit changes when the player changes it,
// which happens on the shop screen and not during a round — so there is nothing
// to poll for and no event to subscribe to. A round that started before a
// purchase keeps the marks it started with, which is also the less surprising
// behaviour.
//
// **And only when there is a round to draw**, which a test caught rather than a
// review: `solo.test.tsx` asserts that a topic the route would refuse *asks the
// server for nothing*, and a fetch on mount broke it. That claim is worth more
// than the convenience — a screen that has decided not to play should not touch
// the network — so the caller says when.
//
// A guest gets `{ marker: null, markStyle: null }` from the endpoint rather than
// a refusal, so there is no signed-out branch here: wearing nothing is what
// every screen falls back to anyway.
//
// **The signal is checked once the response arrives, not only passed to
// `fetch`.**
// Aborting is necessary and not sufficient, which CI found rather than a
// review: `fetch` honours a signal, but the gap between a response resolving
// and this function acting on it does not — so a round left in that gap set
// state on a component that had gone. In a browser that is a wasted render; in
// a test it is work that outlives the environment, and Vitest reported
// `ReferenceError: window is not defined` as an unhandled error while every
// one of its 1,530 cases passed. A suite that is green and a job that fails is
// the worst way to be told.
import { accountApi, decode } from '@wikifake/protocol';
import { useEffect, useState } from 'react';

/** The two slots a round draws with. The frame is the board's, server-side. */
export interface WornMarks {
  readonly marker: string | null;
  readonly markStyle: string | null;
}

export const NOTHING_WORN: WornMarks = { marker: null, markStyle: null };

export function useOutfit(when: boolean): WornMarks {
  const [worn, setWorn] = useState<WornMarks>(NOTHING_WORN);

  useEffect(() => {
    if (!when) return;

    const stop = new AbortController();

    void (async () => {
      try {
        const answer = await fetch('/api/account/cosmetics', { signal: stop.signal });
        // **One guard, and it is here rather than beside `setWorn`.** Reading
        // the body is the first work after the response arrives, so stopping
        // before it stops everything that follows. A second check further down
        // was written and then removed: `setWorn` on an unmounted component is
        // a no-op in React 18, so that guard could not be observed by any test
        // — and an unobservable guard is decoration, which I.1 learned about a
        // different one.
        if (stop.signal.aborted || !answer.ok) return;

        const said = decode(accountApi.readCosmeticsResponse, await answer.json());
        // A body that cannot be read leaves the default in place. Nothing here
        // is worth an error message: the player sees the marks they always had.
        if (said.ok)
          setWorn({ marker: said.value.marker, markStyle: said.value.markStyle });
      } catch {
        // Including the abort, which is not a failure.
      }
    })();

    return () => {
      stop.abort();
    };
    // `when` only ever goes false → true here, so this reads once. It is in the
    // list because leaving it out would be a lie about what the effect uses.
  }, [when]);

  return worn;
}
