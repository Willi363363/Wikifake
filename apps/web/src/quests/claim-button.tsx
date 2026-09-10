'use client';

// The one control on the quests screen — step F.7.
//
// A client component because it posts and then has to say what happened, and
// the smallest thing that can be one: the list around it stays on the server,
// so a browser is handed quests rather than a query.
//
// **It refreshes rather than re-rendering itself.** `router.refresh()` re-runs
// the server component, which re-reads the row and the rounds — so the claimed
// state a player sees afterwards is the database's answer and not this
// component's optimism. An optimistic update here would be a second opinion
// about whether a claim succeeded, and F.6 exists precisely because that
// question has one answer.
import { Button } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export interface ClaimButtonProps {
  readonly questId: string;
}

/** The refusals a player can be told apart, from F.6's three codes. */
type Refusal = 'quest_not_complete' | 'quest_already_claimed' | 'quest_not_found';

const REFUSALS: readonly Refusal[] = [
  'quest_not_complete',
  'quest_already_claimed',
  'quest_not_found',
];

/** The server's code, when it sent one this screen has a sentence for. */
function refusalIn(body: unknown): Refusal | null {
  const code = (body as { code?: unknown } | null)?.code;
  return REFUSALS.find((known) => known === code) ?? null;
}

export function ClaimButton({ questId }: ClaimButtonProps) {
  const t = useTranslations('quests');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const claim = (): void => {
    if (busy) return;
    setBusy(true);
    setRefused(null);

    void (async () => {
      try {
        const answer = await fetch('/api/quests/claim', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ questId }),
        });

        if (answer.ok) {
          // Not `setBusy(false)` first: the refresh replaces this row with a
          // claimed one, and a button that goes back to saying "Claim" for a
          // frame is a button somebody clicks twice.
          router.refresh();
          return;
        }

        const code = refusalIn(await answer.json().catch(() => null));
        // A code this screen knows gets its own sentence; anything else is the
        // unreachable case, because a refusal and a dead connection are
        // different things and telling somebody on a train that their quest is
        // unfinished would be a lie.
        setRefused(code === null ? t('errors.unreachable') : t(`errors.${code}`));
        setBusy(false);
      } catch {
        setRefused(t('errors.unreachable'));
        setBusy(false);
      }
    })();
  };

  return (
    <>
      <Button variant="primary" onClick={claim} disabled={busy}>
        {busy ? t('claiming') : t('claim')}
      </Button>
      {refused === null ? null : (
        // A wash with `ink` on it, not a fill used as a text colour.
        <p
          role="alert"
          className="mt-2 border-3 border-line-strong bg-danger-soft px-3 py-2 text-sm text-ink"
        >
          {refused}
        </p>
      )}
    </>
  );
}
