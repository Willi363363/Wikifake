'use client';

// The nickname a tab does not have — step P.3.
//
// The nickname lives in `sessionStorage`, which is per tab. A room URL opened
// in a tab that never went through `/play` therefore has none, and the gate
// used to answer that by setting the identity to null and never asking again:
// the socket never opened, and `room.tsx` rendered a badge reading *en attente*
// with nothing on screen to act on.
//
// **It asks rather than redirecting**, and that is the decision of the step.
// `/play` would throw the room code away — which is precisely what a player who
// followed a link cannot get back, since the URL they arrived by is the thing
// they are being sent away from. The prompt keeps the code, asks the one thing
// missing, and lands them in the room they were invited to.
//
// It is not `/choose-a-name`. That screen names an **account** and sends a
// guest to sign up by design (step E.3.2); what is missing here is a nickname
// for one tab, and there may be no account at all.
//
// Validated against `playerName` from `@wikifake/protocol` — the schema the
// server refuses with — for the reason `entry.tsx` gives at its own top: a name
// waved through here is a socket that opens, is refused, and shows the player a
// dead connection instead of "that nickname is not allowed".
import { decode, playerName } from '@wikifake/protocol';
import { Button, Input } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import { useId, useState, type FormEvent } from 'react';

export interface NamePromptProps {
  /** Shown, because keeping it in front of the player is the whole point. */
  readonly roomCode: string;
  /** The accepted, trimmed name. Remembering it is the gate's business. */
  onChosen(name: string): void;
}

export function NamePrompt({ roomCode, onChosen }: NamePromptProps) {
  const t = useTranslations('lobby.name');
  const field = useId();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent): void => {
    event.preventDefault();

    const read = decode(playerName, typed);
    if (!read.ok) {
      // The decoder's own sentence first — it is authored beside the schema and
      // says which rule was broken. The fallback is for a refusal with no
      // reason attached.
      setError(read.issues[0] ?? t('error'));
      return;
    }
    onChosen(read.value);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 py-10">
      <header className="text-center">
        <p className="text-xs tracking-widest text-muted uppercase">{t('eyebrow')}</p>
        <h1 className="font-mono text-3xl tracking-[0.2em] text-ink">{roomCode}</h1>
      </header>

      <p className="text-center text-sm text-ink-2">{t('body')}</p>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={field} className="text-[13px] font-medium text-ink">
            {t('label')}
          </label>
          <Input
            id={field}
            value={typed}
            maxLength={24}
            autoComplete="nickname"
            onChange={(event) => {
              setTyped(event.target.value);
            }}
          />
        </div>

        {error === null ? null : (
          // Announced rather than merely displayed, as `entry.tsx` does.
          <p
            role="alert"
            className="m-0 rounded-lg bg-danger-soft px-3 py-2 text-center text-sm text-ink"
          >
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg">
          {t('submit')}
        </Button>
      </form>
    </main>
  );
}
