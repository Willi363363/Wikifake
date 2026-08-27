'use client';

// Where the topic comes from, and the only piece that knows.
//
// Split from `SoloGame` for the same reason `RoomScreen` is split from `Room`:
// the journey takes its topic as a parameter and can then be driven by a test
// with no router at all, and the reading of the URL happens in exactly one
// place.
import { useSearchParams } from 'next/navigation';

import { SoloGame } from './solo.js';

export function SoloEntry() {
  return <SoloGame topic={useSearchParams().get('topic')} />;
}
