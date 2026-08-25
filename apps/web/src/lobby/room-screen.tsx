'use client';

// The room, with its code and its player.
//
// Split from `Room` so `Room` takes both as parameters and can be rendered by a
// test without a router or a storage: the screen is where routing is read, and
// it is the only place that reads it.
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Room } from './room.js';
import { readNickname } from '../realtime/room-gate.js';

export function RoomScreen() {
  const params = useParams<{ code?: string }>();
  const [nickname, setNickname] = useState<string | null>(null);

  // After mount: `sessionStorage` does not exist on the server, and a value read
  // during render is a hydration mismatch waiting to happen.
  useEffect(() => {
    setNickname(readNickname());
  }, []);

  return <Room roomCode={params.code ?? ''} nickname={nickname} />;
}
