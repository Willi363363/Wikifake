'use client';

// What the solo route shows until step 7.8 wires it to `POST /api/game/start`.
//
// It carries the topic the entry screen collected, which is the part of the
// journey 7.2 owns: the entry leads to the right screen, with the right thing in
// its hands.
import { Badge } from '@wikifake/ui';
import { useSearchParams } from 'next/navigation';

export function SoloPlaceholder() {
  const topic = useSearchParams().get('topic') ?? '';

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold text-ink">Solo</h1>
      <p>
        <Badge tone="accent">{topic === '' ? 'no topic' : topic}</Badge>
      </p>
      <p className="text-sm text-muted">
        The round is wired to the API in step 7.8, and replaced by phase 8.
      </p>
    </main>
  );
}
