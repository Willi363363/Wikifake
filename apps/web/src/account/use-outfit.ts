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

    // Aborted on unmount, so a round left before the answer arrives does not
    // set state on a component that has gone.
    const stop = new AbortController();

    void (async () => {
      try {
        const answer = await fetch('/api/account/cosmetics', { signal: stop.signal });
        if (!answer.ok) return;

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
