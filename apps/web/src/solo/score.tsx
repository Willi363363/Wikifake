'use client';

// What the score was made of.
//
// Six numbers, and every one of them decided by the server: C1.3 is not a rule
// applied here, it is the shape of the request — `submitRequest` carries a
// session handle and a list of paragraphs, and has no field for a penalty. So
// this screen adds nothing up. It reads a breakdown.
//
// The debrief proper — which paragraph was false, what the truth was, what the
// hints said — is phase 8. It needs the solution, which arrives with this same
// response and is deliberately not shown yet.
import type { gameApi } from '@wikifake/protocol';
import { Badge, buttonVariants, Separator } from '@wikifake/ui';
import Link from 'next/link';

export interface SoloScoreProps {
  readonly topic: string;
  readonly result: gameApi.SubmitResponse;
}

/** The breakdown, in the order it reads: what you earned, then what it cost. */
const ROWS: readonly {
  readonly label: string;
  readonly of: keyof gameApi.SubmitResponse['breakdown'];
  /** Whether the number is a deduction, which is what the sign is for. */
  readonly against?: true;
}[] = [
  { label: 'Found', of: 'truePositives' },
  { label: 'Wrongly marked', of: 'falsePositives', against: true },
  { label: 'Hints used', of: 'hintsUsed' },
  { label: 'Hint penalty', of: 'hintPenalty', against: true },
  { label: 'Stolen from you', of: 'scoreStolen', against: true },
  { label: 'Time bonus', of: 'timeBonus' },
];

export function SoloScore({ topic, result }: SoloScoreProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-10">
      <div className="rounded-xl border border-line bg-surface p-6 text-center shadow-md">
        <p className="text-xs tracking-widest text-muted uppercase">{topic}</p>
        <p className="mt-2 font-mono text-5xl tabular-nums text-ink" aria-live="polite">
          {String(result.score)}
        </p>
        <p className="mt-1 text-sm text-muted">points</p>

        <Separator className="my-5" />

        <dl className="space-y-2 text-left text-sm">
          {ROWS.map((row) => {
            const value = result.breakdown[row.of];
            return (
              <div key={row.of} className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">{row.label}</dt>
                <dd className="font-mono tabular-nums text-ink">
                  {row.against === true && value > 0
                    ? `−${String(value)}`
                    : String(value)}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      <p className="text-center">
        {/* The solution arrived with this response and is not on screen: the
            debrief is phase 8, and saying so beats a blank space. */}
        <Badge tone="bronze">the full correction arrives in phase 8</Badge>
      </p>

      {/* A link, styled as the primary button: the destination is a page, and a
          `<button>` that navigates is a button that cannot be opened in a new
          tab or read by anything that lists a page's links. */}
      <Link href="/play" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
        Play again
      </Link>
    </main>
  );
}
