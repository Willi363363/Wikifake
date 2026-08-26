'use client';

// Which room the provider is connected to, read from the URL.
//
// Separate from the provider so the provider knows nothing about routing: it
// takes a room and a nickname and owns a socket, which is what makes it testable
// without a router. This is the piece that says where those two come from — and
// it is deliberately the only piece that does.
//
// The nickname is not in the URL. It is what the player typed on the entry
// screen (step 7.2), so it lives in `sessionStorage` beside the session token:
// same lifetime, same tab, and a refresh mid-game must not lose the seat.
import { useParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { RealtimeProvider } from './provider.js';

const NICKNAME = 'wikifake.nickname';

/** What the player typed, or null before they have typed it. */
export function readNickname(): string | null {
  try {
    const held = globalThis.sessionStorage.getItem(NICKNAME);
    return held === null || held === '' ? null : held;
  } catch {
    return null;
  }
}

export function rememberNickname(name: string): void {
  try {
    globalThis.sessionStorage.setItem(NICKNAME, name);
  } catch {
    // A private window with storage disabled. The player can still play; what
    // they lose is the seat across a refresh, which is not worth refusing over.
  }
}

export function RoomGate({ children }: { children: ReactNode }) {
  const params = useParams<{ code?: string }>();
  const code = params.code ?? null;

  // Read after mount, never during render: `sessionStorage` does not exist on
  // the server, and a value read during render is a hydration mismatch waiting
  // to happen.
  //
  // Keyed on the room code, and that is not a detail. This gate lives in the
  // layout of the `(game)` group precisely so it survives the navigation from
  // the entry screen into a room — which means it mounts while there is no
  // nickname yet, and an effect that ran once would never see the one the entry
  // screen writes a moment later. The socket would then never open at all: the
  // provider stays idle on a `playerName` of null, for the whole life of the
  // room.
  //
  // Found by the browser tests of step 9.5, on the first run. Every unit suite
  // passes the nickname in as a prop, so none of them could have seen it.
  const [nickname, setNickname] = useState<string | null>(null);
  useEffect(() => {
    setNickname(readNickname());
  }, [code]);

  return (
    <RealtimeProvider roomCode={code} playerName={nickname}>
      {children}
    </RealtimeProvider>
  );
}
