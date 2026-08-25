// The layout the whole game lives inside.
//
// A route group — the parentheses keep `(game)` out of the URL — so `/play` and
// `/room/A1B2C3` share this layout and Next does **not** unmount it when the
// player moves between them. That is the entire point: the socket is opened by
// the provider below, and a provider that unmounted on navigation would reopen
// the connection on every screen. The server would see a departure and an
// arrival it cannot tell from a flapping network, and D5's grace window would
// be spent on a player who never left.
import type { ReactNode } from 'react';

import { RoomGate } from '../../src/realtime/room-gate.js';

export default function GameLayout({ children }: { children: ReactNode }) {
  return <RoomGate>{children}</RoomGate>;
}
