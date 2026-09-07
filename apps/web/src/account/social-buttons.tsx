'use client';

// The providers this deployment offers — step E.2.
//
// The list arrives as a prop from a server component, and it is a list of
// **names**: `offeredProviders` exists so that the thing crossing into the
// document cannot be a client secret. See `auth/providers.ts`.
//
// Nothing is rendered when nothing is configured, and that is the normal state
// of a developer's machine and of every run of this repository's tests. A
// heading saying "or continue with" above no buttons would be the giveaway, so
// the heading is inside the guard.
import { Button } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { ProviderId } from '../auth/providers.js';
import { authClient, failureOf } from './client.js';

export interface SocialButtonsProps {
  readonly providers: readonly ProviderId[];
  /** Where to land once the provider has sent the player back. */
  readonly next?: string;
}

export function SocialButtons({ providers, next = '/play' }: SocialButtonsProps) {
  const t = useTranslations('account');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ProviderId | null>(null);

  if (providers.length === 0) return null;

  const start = async (provider: ProviderId): Promise<void> => {
    setError(null);
    setBusy(provider);
    try {
      // `callbackURL` is where the *provider* sends the player back to, and it
      // is a path rather than a URL on purpose: the client resolves it against
      // the page's own origin, so a preview cannot bounce a player into
      // production.
      const answer = await authClient.signIn.social({ provider, callbackURL: next });
      if (answer.error) setError(failureOf(answer.error, t('errors.socialFailed')));
    } catch {
      setError(t('errors.unreachable'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-center text-xs tracking-wide text-muted uppercase">
        {t('orContinueWith')}
      </p>

      {providers.map((provider) => (
        <Button
          key={provider}
          variant="ghost"
          size="lg"
          className="w-full"
          disabled={busy !== null}
          onClick={() => {
            void start(provider);
          }}
        >
          {/* Keyed by provider so a name is translated copy rather than a
              capitalised id — "GitHub" has a capital H that no `toUpperCase`
              produces. */}
          {t(`providers.${provider}`)}
        </Button>
      ))}

      {error === null ? null : (
        <p
          role="alert"
          className="border-3 border-line-strong bg-danger-soft px-3 py-2 text-center text-sm text-ink"
        >
          {error}
        </p>
      )}
    </div>
  );
}
