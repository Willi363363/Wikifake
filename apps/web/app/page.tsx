// The front door.
//
// A redirect rather than a copy of the entry screen: the entry lives inside the
// `(game)` group because the socket provider has to be mounted before a room is
// opened, and a second copy at the root would be a second place to keep in step.
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/play');
}
