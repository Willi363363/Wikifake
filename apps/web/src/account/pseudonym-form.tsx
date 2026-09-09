'use client';

// Choosing the name other players see — step E.3.2.
//
// The one form that claims a pseudonym, and it is the same call sign-up makes:
// `POST /api/account/pseudonym`. Two screens, one endpoint, so "taken" can only
// be worded once.
//
// **The server's refusal is the good one, and this screen shows it verbatim** —
// the same rule `credentials-form.tsx` follows. What is checked here is only
// what a player can fix before a round trip: `playerName`, the protocol's own
// decoder, so an account cannot be created under a name its owner could never
// play a room as. Whether somebody else already holds it is a race this browser
// cannot see, and a client that guessed at it would guess wrong.
import { decode, playerName } from '@wikifake/protocol';
import { Button, Input, Label } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';

import { claim } from './claim-request.js';

export interface PseudonymFormProps {
  /** Where to land once the name is theirs. The game, by default. */
  readonly next?: string;
  /**
   * A name a previous attempt failed on, so the field opens filled in.
   *
   * Sign-up sends the player here when its own claim was refused, and arriving
   * at an empty box after typing a name is how somebody concludes the first
   * screen lost their account.
   */
  readonly attempted?: string;
}

export function PseudonymForm({ next = '/play', attempted = '' }: PseudonymFormProps) {
  const t = useTranslations('account');
  const router = useRouter();
  const ids = useId();

  const [pseudonym, setPseudonym] = useState(attempted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);

    // The protocol's own decoder and its own sentence, so this screen and the
    // socket can never disagree about what a name may contain.
    const read = decode(playerName, pseudonym);
    if (!read.ok) {
      setError(read.issues[0] ?? t('errors.pseudonym'));
      return;
    }

    setBusy(true);
    try {
      const answer = await claim(read.value);
      if (!answer.ok) {
        setError(answer.message ?? t('errors.pseudonymFailed'));
        return;
      }
      router.push(next);
      // The screens that read a pseudonym are server components, so the tree
      // Next is holding for them was rendered before this claim existed.
      // Without the refresh the player arrives at the gate that sent them here.
      router.refresh();
    } catch {
      // The request never arrived — distinct from a refusal, and the only case
      // this screen writes a sentence for.
      setError(t('errors.unreachable'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${ids}-pseudonym`}>{t('pseudonymLabel')}</Label>
        <Input
          id={`${ids}-pseudonym`}
          value={pseudonym}
          maxLength={24}
          autoComplete="nickname"
          // The only field on the screen, and the reason the player is here.
          autoFocus
          onChange={(event) => {
            setPseudonym(event.target.value);
          }}
        />
        <p className="text-xs text-muted">{t('pseudonymHint')}</p>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={busy}
      >
        {busy ? t('chooseBusy') : t('chooseSubmit')}
      </Button>

      {error === null ? null : (
        // `role="alert"`, so a screen reader is told rather than left to notice.
        <p
          role="alert"
          className="border-3 border-line-strong bg-danger-soft px-3 py-2 text-center text-sm text-ink"
        >
          {error}
        </p>
      )}
    </form>
  );
}
