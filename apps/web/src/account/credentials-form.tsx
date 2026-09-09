'use client';

// Sign in and sign up — step E.2, as one component rendered twice.
//
// The two screens differ by one field and one call. Two files would drift the
// first time somebody fixed a label on one of them, and the drift would be
// invisible: nobody opens both at once. `ArticleBeat` is the same argument in
// track C, and this is the same answer.
//
// **The server is authoritative and its sentences are the good ones.** What is
// checked here is what the player can fix before a round trip — an empty field,
// a pseudonym the room protocol would refuse anyway — and everything else is
// Better Auth's message shown verbatim. A client that invented "that email is
// taken" would be a client guessing at a race it cannot see.
//
// The pseudonym is validated against `playerName` from `@wikifake/protocol`,
// which is the schema the socket refuses a room nickname with. One rule, so an
// account cannot be created under a name its owner can never play as.
//
// **Step E.3.2 — and the account is created before the pseudonym is claimed.**
// The two cannot be one statement: Better Auth owns the first and the row that
// holds the second needs the account's id. So the order is deliberate, and so
// is what happens when the claim is refused — the account exists, the player is
// signed in, and sending them back to a sign-up form would tell them their own
// address is taken. They go to `/choose-a-name` instead, with the name they
// tried, which is the screen every Google account lands on anyway. The
// unpleasant path and the ordinary path are the same path, so it is walked.
import { decode, playerName } from '@wikifake/protocol';
import { Button, Input, Label } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';

import { authClient, failureOf } from './client.js';
import { claim } from './claim-request.js';

export type CredentialsMode = 'signIn' | 'signUp';

export interface CredentialsFormProps {
  readonly mode: CredentialsMode;
  /** Where to land once there is a session. The game, by default. */
  readonly next?: string;
}

/**
 * Better Auth's own floor, restated so the message arrives before the request.
 *
 * Eight characters is the library's default `minPasswordLength`. Duplicated on
 * purpose and named here rather than inlined: the alternative is a player
 * typing seven characters, waiting for a round trip, and being told by a server.
 */
const MIN_PASSWORD = 8;

export function CredentialsForm({ mode, next = '/play' }: CredentialsFormProps) {
  const t = useTranslations('account');
  const router = useRouter();
  const ids = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pseudonym, setPseudonym] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (email.trim() === '') {
      setError(t('errors.emailRequired'));
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(t('errors.passwordShort', { count: MIN_PASSWORD }));
      return;
    }

    let name = '';
    if (mode === 'signUp') {
      // The protocol's own decoder, and its own sentence: the same one the
      // socket would refuse the nickname with, so the two can never disagree.
      const read = decode(playerName, pseudonym);
      if (!read.ok) {
        setError(read.issues[0] ?? t('errors.pseudonym'));
        return;
      }
      name = read.value;
    }

    setBusy(true);
    try {
      const answer =
        mode === 'signUp'
          ? await authClient.signUp.email({ email: email.trim(), password, name })
          : await authClient.signIn.email({ email: email.trim(), password });

      if (answer.error) {
        setError(failureOf(answer.error, t(`errors.${mode}Failed`)));
        return;
      }

      if (mode === 'signUp') {
        const taken = await claim(name);
        if (!taken.ok) {
          // Not an error shown here: there is a session now, and this form can
          // no longer do anything about it. `router.refresh()` so the screen
          // being navigated to is rendered for the account that now exists.
          router.push(`/choose-a-name?attempted=${encodeURIComponent(name)}`);
          router.refresh();
          return;
        }
      }

      router.push(next);
    } catch {
      // The request never arrived. Distinct from a refusal, and the only case
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
        <Label htmlFor={`${ids}-email`}>{t('emailLabel')}</Label>
        <Input
          id={`${ids}-email`}
          type="email"
          value={email}
          autoComplete="email"
          // `inputMode` as well as `type`: a phone keyboard that offers `@`
          // without switching layers is the difference between typing an
          // address once and typing it three times.
          inputMode="email"
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
      </div>

      {mode === 'signUp' ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${ids}-pseudonym`}>{t('pseudonymLabel')}</Label>
          <Input
            id={`${ids}-pseudonym`}
            value={pseudonym}
            maxLength={24}
            autoComplete="nickname"
            onChange={(event) => {
              setPseudonym(event.target.value);
            }}
          />
          {/* Said before it matters rather than after: the pseudonym is what
              other players see, and the email never is. */}
          <p className="text-xs text-muted">{t('pseudonymHint')}</p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={`${ids}-password`}>{t('passwordLabel')}</Label>
        <Input
          id={`${ids}-password`}
          type="password"
          value={password}
          // `new-password` on sign-up is what makes a manager offer to generate
          // one, and `current-password` on sign-in is what makes it fill in.
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={busy}
      >
        {busy ? t(`${mode}Busy`) : t(`${mode}Submit`)}
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
