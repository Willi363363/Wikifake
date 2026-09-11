// The chassis both account screens sit in — step E.2.
//
// One layout, two modes, for the reason `credentials-form.tsx` gives: the pair
// differ by a heading, a form field and the link at the bottom, and two files
// would drift the first time somebody fixed one of them.
//
// A **server** component, so that the offered providers are read from the
// deployment's own environment rather than from anything a browser could be
// told. What crosses into the client is `ProviderId[]` — names, never
// credentials, by the return type of `offeredProviders`.
import { Separator } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import type { ProviderId } from '../auth/providers.js';
import { CredentialsForm, type CredentialsMode } from './credentials-form.js';
import { SocialButtons } from './social-buttons.js';

export interface AccountScreenProps {
  readonly mode: CredentialsMode;
  readonly providers: readonly ProviderId[];
}

/**
 * The other screen, for each mode: sign-in offers sign-up, and the reverse.
 *
 * The catalogue keys are written out rather than built from the mode. A
 * template literal defeats `next-intl`'s typed keys — the compiler sees
 * `${string}Prompt` and can check nothing — and the whole value of typing the
 * catalogue is that a key nobody translated fails the build.
 */
const OTHER: Record<
  CredentialsMode,
  {
    readonly href: string;
    readonly prompt: 'signInPrompt' | 'signUpPrompt';
    readonly link: 'signInLink' | 'signUpLink';
  }
> = {
  signIn: { href: '/sign-up', prompt: 'signUpPrompt', link: 'signUpLink' },
  signUp: { href: '/sign-in', prompt: 'signInPrompt', link: 'signInLink' },
};

export function AccountScreen({ mode, providers }: AccountScreenProps) {
  const t = useTranslations('account');
  const other = OTHER[mode];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-center text-3xl text-ink">{t(`${mode}Title`)}</h1>
      <p className="mt-2 text-center text-sm text-muted">{t(`${mode}Lead`)}</p>

      <div className="mt-8 border-3 border-line-strong bg-surface p-6 shadow-md">
        <CredentialsForm mode={mode} />

        {providers.length === 0 ? null : (
          <>
            <Separator className="my-5" />
            <SocialButtons providers={providers} />
          </>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        {t(other.prompt)}{' '}
        <Link href={other.href} className="text-ink underline">
          {t(other.link)}
        </Link>
      </p>

      {/* The way past the whole screen. A game that can be played without an
          account is one of this effort's three conditions for "done", and a
          sign-in page with no exit is how that quietly stops being true. */}
      <p className="mt-3 text-center text-sm text-muted">
        <Link href="/play" className="text-ink underline">
          {t('playAsGuest')}
        </Link>
      </p>
    </main>
  );
}
