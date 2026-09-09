// The screen that asks for a pseudonym — step E.3.2.
//
// Its own chassis rather than a third mode of `account-screen.tsx`: that one is
// two ways *in*, with a password field, a provider list and a link to the other
// one, and none of the three is true here. The player is already signed in;
// there is one thing missing and one field to fill.
//
// **No way past it, and that is the difference from every other account
// screen.** The others carry *play without an account*, because a game playable
// without signing up is one of this effort's conditions for done. This player
// has an account: the exit is not "skip", it is "sign out", and offering skip
// would send them straight back to the gate that redirected them here.
import { useTranslations } from 'next-intl';

import { PseudonymForm } from './pseudonym-form.js';
import { SignOutButton } from './sign-out-button.js';

export interface PseudonymScreenProps {
  readonly next?: string;
  /** A name a previous attempt failed on, so the field opens filled in. */
  readonly attempted?: string;
}

export function PseudonymScreen({ next, attempted }: PseudonymScreenProps) {
  const t = useTranslations('account');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-center text-3xl text-ink">{t('chooseTitle')}</h1>
      <p className="mt-2 text-center text-sm text-muted">{t('chooseLead')}</p>

      <div className="mt-8 border-3 border-line-strong bg-surface p-6 shadow-md">
        <PseudonymForm
          {...(next === undefined ? {} : { next })}
          {...(attempted === undefined ? {} : { attempted })}
        />
      </div>

      {/* A button, not a link: the way out of this screen is signing out, and
          there is deliberately no way *past* it. */}
      <div className="mt-6 flex justify-center">
        <SignOutButton />
      </div>
    </main>
  );
}
