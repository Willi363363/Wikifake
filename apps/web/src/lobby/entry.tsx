'use client';

// The first screen: play alone, open a room, or join one.
//
// Three things change from the current one, and only one of them is visual.
//
// The nickname is validated **before any network call**, against `playerName`
// from `@wikifake/protocol` — the same schema the server refuses with. Today the
// client checks `!username`, which passes for a 200-character name full of
// emoji; the socket then opens, the server refuses it, and the player is shown a
// closed connection instead of "that nickname is not allowed".
//
// The room code is validated the same way and upper-cased as it is typed, so
// `a1b2c3` becomes `A1B2C3` rather than a 404.
//
// And the screen is built from the design system rather than from forty inline
// style objects, which is what makes it work in both palettes and at 360 px.
import { decode, playerName, roomCode, topicLabel } from '@wikifake/protocol';
import { Badge, Button, cn, Input, Label, Separator } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';

import { rememberNickname } from '../realtime/room-gate.js';

type Mode = 'solo' | 'host' | 'join';

const TABS: readonly Mode[] = ['solo', 'host', 'join'];

/**
 * The first complaint a schema has, or null when it is satisfied.
 *
 * The primary sentence is the decoder's — authored in `@wikifake/protocol`,
 * which is the same schema the server refuses with. Only the fallback, for a
 * decoder that refused without saying why, is this screen's own copy.
 */
function complaint(
  schema: Parameters<typeof decode>[0],
  value: unknown,
  fallback: string,
): string | null {
  const read = decode(schema, value);
  return read.ok ? null : (read.issues[0] ?? fallback);
}

export function LobbyEntry() {
  const t = useTranslations('lobby.entry');
  const router = useRouter();
  const ids = useId();

  const [mode, setMode] = useState<Mode>('solo');
  const [nickname, setNickname] = useState('');
  const [topic, setTopic] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Validates, remembers, and hands back the trimmed name — or null. */
  const acceptNickname = (): string | null => {
    const read = decode(playerName, nickname);
    if (!read.ok) {
      setError(read.issues[0] ?? t('errors.nickname'));
      return null;
    }
    rememberNickname(read.value);
    return read.value;
  };

  const startSolo = (event: FormEvent): void => {
    event.preventDefault();
    setError(null);

    const wanted = complaint(topicLabel, topic, t('errors.notAllowed'));
    if (wanted !== null) {
      setError(wanted);
      return;
    }
    // Solo has no room and no socket, so it needs no nickname — the round is
    // played by whoever is holding the browser.
    router.push(`/solo?topic=${encodeURIComponent(topic.trim())}`);
  };

  const host = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);

    const name = acceptNickname();
    if (name === null) return;

    setBusy(true);
    try {
      const answer = await fetch('/api/multiplayer/create', { method: 'POST' });
      const body: unknown = await answer.json();

      if (!answer.ok) {
        // The server's own sentence — `room_capacity_reached` says "too many
        // rooms are open", which is a thing a player can act on.
        const said = (body as { message?: string }).message;
        setError(said ?? t('errors.roomNotOpened'));
        return;
      }

      const opened = decode(roomCode, (body as { roomCode?: unknown }).roomCode);
      if (!opened.ok) {
        setError(t('errors.unreadableRoom'));
        return;
      }
      router.push(`/room/${opened.value}`);
    } catch {
      setError(t('errors.unreachable'));
    } finally {
      setBusy(false);
    }
  };

  const join = (event: FormEvent): void => {
    event.preventDefault();
    setError(null);

    const wanted = complaint(roomCode, code.toUpperCase(), t('errors.notAllowed'));
    if (wanted !== null) {
      setError(wanted);
      return;
    }

    const name = acceptNickname();
    if (name === null) return;
    router.push(`/room/${code.toUpperCase()}`);
  };

  const nicknameField = (
    <div className="space-y-1.5">
      <Label htmlFor={`${ids}-nickname`}>{t('nicknameLabel')}</Label>
      <Input
        id={`${ids}-nickname`}
        value={nickname}
        maxLength={24}
        autoComplete="nickname"
        onChange={(event) => {
          setNickname(event.target.value);
        }}
      />
    </div>
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-center text-3xl font-semibold text-ink">{t('brand')}</h1>
      <p className="mt-2 text-center text-sm text-muted">{t('tagline')}</p>

      <div className="mt-8 rounded-xl border border-line bg-surface p-6 shadow-md">
        {/* A tablist, not three buttons that happen to look like one: the roles
            are what let a keyboard move between them. */}
        <div role="tablist" aria-label={t('tabsLabel')} className="flex gap-2">
          {TABS.map((tab) => (
            <Button
              key={tab}
              role="tab"
              aria-selected={mode === tab}
              variant={mode === tab ? 'primary' : 'ghost'}
              className="flex-1"
              onClick={() => {
                setMode(tab);
                setError(null);
              }}
            >
              {t(`tabs.${tab}`)}
            </Button>
          ))}
        </div>

        <Separator className="my-5" />

        {mode === 'solo' ? (
          <form onSubmit={startSolo} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-topic`}>{t('topicLabel')}</Label>
              {/* The topic is a fr.wikipedia.org subject — the placeholder is
                  an example of one ("Chat"), identical in every locale, and
                  what the player types is French data, not interface copy.
                  Hence `lang="fr"` on the field, whatever the interface. */}
              <Input
                id={`${ids}-topic`}
                value={topic}
                lang="fr"
                placeholder={t('topicPlaceholder')}
                onChange={(event) => {
                  setTopic(event.target.value);
                }}
              />
            </div>
            <Button type="submit" variant="primary" size="lg" className="w-full">
              {t('playSolo')}
            </Button>
          </form>
        ) : null}

        {mode === 'host' ? (
          <form
            onSubmit={(event) => {
              void host(event);
            }}
            className="space-y-4"
          >
            {nicknameField}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={busy}
            >
              {busy ? t('opening') : t('openRoom')}
            </Button>
          </form>
        ) : null}

        {mode === 'join' ? (
          <form onSubmit={join} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-code`}>{t('roomCodeLabel')}</Label>
              <Input
                id={`${ids}-code`}
                value={code}
                maxLength={6}
                autoComplete="off"
                // Upper-cased as it is typed, so `a1b2c3` is a room rather than
                // a 404. The server's codes are upper-case by construction.
                className="uppercase"
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase());
                }}
              />
            </div>
            {nicknameField}
            <Button type="submit" variant="primary" size="lg" className="w-full">
              {t('joinSubmit')}
            </Button>
          </form>
        ) : null}

        {error === null ? null : (
          // `role="alert"`, so it is announced rather than merely displayed —
          // the current one is a red paragraph and nothing else.
          <p role="alert" className={cn('mt-4 text-center text-sm text-danger')}>
            {error}
          </p>
        )}
      </div>

      <p className="mt-6 text-center">
        <Badge tone="accent">{t('serverAuthoritative')}</Badge>
      </p>
    </main>
  );
}
