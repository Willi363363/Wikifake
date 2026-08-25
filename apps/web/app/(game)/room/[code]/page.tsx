// The waiting room — step 7.3.
//
// What is here now is the connection and nothing else: the provider has a room
// code from the URL, so this is the first screen where a socket actually opens.
// The roster, the host settings and the ready state are 7.3; the placeholder
// says so rather than pretending to be them.
import { RoomPlaceholder } from '../../../../src/lobby/room-placeholder.js';

export default function RoomPage() {
  return <RoomPlaceholder />;
}
