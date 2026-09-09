'use client';

// The two rights, where a player can reach them — step E.7.
//
// On the profile, because that is the one screen that is theirs and the one
// that already shows them what is held about them. A settings page for two
// buttons would be a screen nobody visits and a right nobody knows they have.
//
// **Export is a link, delete is a button behind a confirmation.** The asymmetry
// is the point: one of them can be done twice with no consequence, and the
// other cannot be undone at all. The confirmation asks the player to type their
// pseudonym, which is the one thing they know and a mis-click does not.
import { Button, Input, Label } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

export interface AccountDataProps {
  /** What the player must type to confirm. Their own name, and nothing else. */
  readonly pseudonym: string;
}

export function AccountData({ pseudonym }: AccountDataProps) {
  const t = useTranslations('account.data');
  const router = useRouter();
  const ids = useId();

  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const answer = await fetch('/api/account/delete', { method: 'POST' });
      if (!answer.ok) {
        setError(t('deleteFailed'));
        return;
      }
      // Home rather than the profile: there is no profile any more, and the
      // refresh is what stops Next serving the tree it rendered for an account
      // that existed a moment ago.
      router.push('/');
      router.refresh();
    } catch {
      setError(t('deleteFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 border-3 border-line-strong bg-surface p-6 shadow-md">
      <h2 className="text-lg text-ink">{t('title')}</h2>

      <p className="mt-3 text-sm text-muted">{t('exportLead')}</p>
      {/* A plain link, not a fetch: the browser knows how to save a file, and
          the route answers with `content-disposition`. A script that built a
          blob would be a second implementation of downloading. */}
      <a
        href="/api/account/export"
        download
        className="mt-1 inline-block text-ink underline"
      >
        {t('exportLink')}
      </a>

      <p className="mt-6 text-sm text-muted">{t('deleteLead')}</p>

      {confirming ? (
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${ids}-confirm`}>{t('confirmLabel', { pseudonym })}</Label>
            <Input
              id={`${ids}-confirm`}
              value={typed}
              autoComplete="off"
              onChange={(event) => {
                setTyped(event.target.value);
              }}
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant="danger"
              // Exactly their own name. Not case-folded: this is a deliberate
              // act, not a login, and the moment's pause is the feature.
              disabled={busy || typed !== pseudonym}
              onClick={() => {
                void remove();
              }}
            >
              {busy ? t('deleteBusy') : t('deleteConfirm')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirming(false);
                setTyped('');
                setError(null);
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1">
          <Button
            variant="danger"
            onClick={() => {
              setConfirming(true);
            }}
          >
            {t('deleteStart')}
          </Button>
        </p>
      )}

      {error === null ? null : (
        <p
          role="alert"
          className="mt-3 border-3 border-line-strong bg-danger-soft px-3 py-2 text-sm text-ink"
        >
          {error}
        </p>
      )}
    </section>
  );
}
