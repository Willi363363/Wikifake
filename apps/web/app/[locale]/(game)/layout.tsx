// The layout the whole game lives inside.
//
// A route group — the parentheses keep `(game)` out of the URL — so `/play` and
// `/room/A1B2C3` share this layout and Next does **not** unmount it when the
// player moves between them. That is the entire point: the socket is opened by
// the provider below, and a provider that unmounted on navigation would reopen
// the connection on every screen. The server would see a departure and an
// arrival it cannot tell from a flapping network, and D5's grace window would
// be spent on a player who never left.
//
// The chat is mounted here for the same reason, and it is the whole of step
// 7.7: one instance, beside the provider rather than inside a screen. The
// current game mounts one in the lobby and another in the round, so the history
// dies with the screen that held it. Here no screen owns it, and none of them
// has to remember to mount it.
import type { ReactNode } from 'react';

import { ChatDock } from '../../../src/chat/chat.js';
import { RoomGate } from '../../../src/realtime/room-gate.js';

export default function GameLayout({ children }: { children: ReactNode }) {
  return (
    <RoomGate>
      {children}
      <ChatDock />
    </RoomGate>
  );
}
