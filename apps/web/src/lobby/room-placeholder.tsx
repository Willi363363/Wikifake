'use client';

// What a room shows until step 7.3 fills it in.
//
// It is not a stub for its own sake: it reports the connection, which is the one
// thing 7.1 delivered and the one thing a reviewer can check by hand today —
// open two tabs on the same code and both should say `open`.
import { Badge } from '@wikifake/ui';
import { useParams } from 'next/navigation';

import { useRealtime } from '../realtime/provider.js';

const TONE = {
  idle: 'neutral',
  connecting: 'warn',
  open: 'green',
  reconnecting: 'warn',
  closed: 'danger',
} as const;

export function RoomPlaceholder() {
  const params = useParams<{ code?: string }>();
  const { status, refusal } = useRealtime();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 text-center">
      <h1 className="font-mono text-3xl tracking-[0.2em] text-ink">
        {params.code ?? '—'}
      </h1>
      <p>
        <Badge tone={TONE[status]}>{status}</Badge>
      </p>
      {refusal === null ? null : (
        <p role="alert" className="text-sm text-danger">
          {refusal}
        </p>
      )}
      <p className="text-sm text-muted">
        The roster, the host settings and the ready state arrive in step 7.3.
      </p>
    </main>
  );
}
