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

import { NamePrompt } from '../lobby/name-prompt.js';
import { RealtimeProvider } from './provider.js';
import { fetchIdentity, type Identity } from './ticket.js';

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
  //
  // Step E.3b.2 added the second thing to resolve, and it is resolved here for
  // the same reason as the first: the socket must not open until both are
  // known. The identity is captured when a player **joins**, so a connection
  // opened a moment early is a round attributed to nobody, with no second
  // chance later in it.
  //
  // The two are one piece of state on purpose. Two would let the provider see a
  // nickname and no ticket for one render, which is exactly the connection this
  // is here to prevent.
  //
  // Step E.3.3 — and the **name** now comes back from the same answer. What is
  // in `sessionStorage` is what the browser would like to be called; a
  // signed-in account is shown under its pseudonym whatever that says. The
  // common disagreement is not an attack: it is a nickname left over from
  // playing as a guest before signing up, and the server correcting it is what
  // stops that name following somebody into every room they join afterwards.
  const [identity, setIdentity] = useState<Identity | null>(null);

  /**
   * What this tab is called, **and which room we read it for** — step P.3.
   *
   * It used to be read inside the effect below and thrown away, which is the
   * defect: `readNickname()` answering null set the identity to null, and
   * since `code` had not changed **the effect never ran again**. The provider
   * stayed idle on a `playerName` of null, the socket never opened, and
   * `room.tsx` rendered a badge reading *en attente* with nothing to act on.
   *
   * Holding it in state fixes both halves: a null is a state the gate can
   * render a prompt for, and the name the player then types is a
   * **dependency**, so the effect runs again rather than waiting on a room
   * code that is never going to change.
   *
   * The room it was read for is carried with it, and that is not bookkeeping.
   * Without it, the render between a navigation and the effect that follows it
   * sees the *previous* room's answer — and for the journey this gate exists
   * to serve, entry screen into a room, the previous answer is "no name",
   * which flashes the prompt at a player who typed one a moment ago. Found by
   * `reads the nickname the entry screen wrote on its way out`, which is the
   * test 9.5 left behind for exactly this shape of mistake.
   */
  const [naming, setNaming] = useState<{
    readonly code: string | null;
    readonly name: string | null;
  } | null>(null);

  // Keyed on the room for the same reason the identity is: the gate mounts
  // before the entry screen has written anything, and a navigation into a
  // second room must look again. A name typed at the prompt survives it, since
  // the prompt stores it before announcing it and this re-read finds it there.
  useEffect(() => {
    setNaming({ code, name: readNickname() });
  }, [code]);

  /** The answer for *this* room, or null while we are still looking. */
  const named = naming !== null && naming.code === code ? naming : null;

  useEffect(() => {
    const name = named?.name ?? null;
    if (code === null || name === null) {
      setIdentity(null);
      return undefined;
    }

    let live = true;
    // A failure is an empty ticket and the requested name, never a rejection:
    // no ticket means the round is played unattributed, which is what every
    // multiplayer round did before E.3b.2. Refusing to open a room because a
    // statistics counter cannot be credited would trade a whole feature for a
    // number.
    void fetchIdentity(code, name).then((answered) => {
      if (live) setIdentity(answered);
    });

    return () => {
      live = false;
    };
  }, [code, named?.name]);

  // The prompt replaces the children rather than sitting above them, and that
  // is load-bearing: `RoomScreen` is one of those children and reads the same
  // `sessionStorage` on mount. Rendered now, it would read the nothing that is
  // there and keep it. Mounted after the name is stored, it reads the name.
  if (code !== null && named !== null && named.name === null) {
    return (
      <NamePrompt
        roomCode={code}
        onChosen={(name) => {
          // Stored first, then announced: `RoomScreen` reads the storage, not
          // this state, and the order is what makes the two agree.
          rememberNickname(name);
          setNaming({ code, name });
        }}
      />
    );
  }

  return (
    <RealtimeProvider
      roomCode={code}
      playerName={identity?.playerName ?? null}
      ticket={identity?.ticket ?? ''}
    >
      {children}
    </RealtimeProvider>
  );
}
