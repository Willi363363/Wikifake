// The waiting room — step 7.3.
//
// The provider of 7.1 already has this room's code from the URL, so the socket
// is open by the time this renders. What the screen adds is the roster, the
// host's settings and the ready state — all of it read from the server's
// `lobby_update`, none of it tallied here.
import { RoomScreen } from '../../../../src/lobby/room-screen.js';

export default function RoomPage() {
  return <RoomScreen />;
}
