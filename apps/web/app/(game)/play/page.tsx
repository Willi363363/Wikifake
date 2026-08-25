// The entry screen.
//
// Inside the `(game)` group on purpose: the provider of 7.1 is already mounted
// here, idle because there is no room yet. Opening or joining one is then a
// navigation *within* the group, so the socket opens once, where it would
// otherwise open, close and reopen across the transition.
import { LobbyEntry } from '../../../src/lobby/entry.js';

export default function PlayPage() {
  return <LobbyEntry />;
}
