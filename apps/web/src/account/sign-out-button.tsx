'use client';

// The way out — step E.5.
//
// A button and not a link, because signing out is a thing that happens rather
// than a place to go: it clears a session on the server and must not be
// prefetched, followed by a crawler, or triggered by a browser guessing at a
// URL it saw.
//
// `router.refresh()` after the push, and it is not belt-and-braces. The profile
// is a server component, so the tree Next holds for it was rendered with a
// session; without the refresh, going back would show the same page rendered
// for somebody who is no longer signed in.
import { Button } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { authClient } from './client.js';

export function SignOutButton() {
  const t = useTranslations('account.profile');
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="ghost"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void authClient
          .signOut()
          .catch(() => {
            // Nothing to say and nothing to recover: the cookie is the session,
            // and a failed call leaves the player exactly where they were.
          })
          .finally(() => {
            router.push('/');
            router.refresh();
          });
      }}
    >
      {busy ? t('signingOut') : t('signOut')}
    </Button>
  );
}
