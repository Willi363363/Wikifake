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
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';

import { rememberNickname } from '../realtime/room-gate.js';

type Mode = 'solo' | 'host' | 'join';

const TABS: readonly { readonly id: Mode; readonly label: string }[] = [
  { id: 'solo', label: 'Solo' },
  { id: 'host', label: 'Host' },
  { id: 'join', label: 'Join' },
];

/** The first complaint a schema has, or null when it is satisfied. */
function complaint(schema: Parameters<typeof decode>[0], value: unknown): string | null {
  const read = decode(schema, value);
  return read.ok ? null : (read.issues[0] ?? 'that is not allowed');
}

export function LobbyEntry() {
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
      setError(read.issues[0] ?? 'that nickname is not allowed');
      return null;
    }
    rememberNickname(read.value);
    return read.value;
  };

  const startSolo = (event: FormEvent): void => {
    event.preventDefault();
    setError(null);

    const wanted = complaint(topicLabel, topic);
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
        setError(said ?? 'the room could not be opened');
        return;
      }

      const opened = decode(roomCode, (body as { roomCode?: unknown }).roomCode);
      if (!opened.ok) {
        setError('the server opened a room we cannot read');
        return;
      }
      router.push(`/room/${opened.value}`);
    } catch {
      setError('the server could not be reached');
    } finally {
      setBusy(false);
    }
  };

  const join = (event: FormEvent): void => {
    event.preventDefault();
    setError(null);

    const wanted = complaint(roomCode, code.toUpperCase());
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
      <Label htmlFor={`${ids}-nickname`}>Nickname</Label>
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
      <h1 className="text-center text-3xl font-semibold text-ink">WikiFake</h1>
      <p className="mt-2 text-center text-sm text-muted">
        A Wikipedia article, some errors slipped into it, and you.
      </p>

      <div className="mt-8 rounded-xl border border-line bg-surface p-6 shadow-md">
        {/* A tablist, not three buttons that happen to look like one: the roles
            are what let a keyboard move between them. */}
        <div role="tablist" aria-label="How to play" className="flex gap-2">
          {TABS.map((tab) => (
            <Button
              key={tab.id}
              role="tab"
              aria-selected={mode === tab.id}
              variant={mode === tab.id ? 'primary' : 'ghost'}
              className="flex-1"
              onClick={() => {
                setMode(tab.id);
                setError(null);
              }}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <Separator className="my-5" />

        {mode === 'solo' ? (
          <form onSubmit={startSolo} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-topic`}>Wikipedia topic</Label>
              <Input
                id={`${ids}-topic`}
                value={topic}
                placeholder="Chat"
                onChange={(event) => {
                  setTopic(event.target.value);
                }}
              />
            </div>
            <Button type="submit" variant="primary" size="lg" className="w-full">
              Play solo
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
              {busy ? 'Opening…' : 'Open a room'}
            </Button>
          </form>
        ) : null}

        {mode === 'join' ? (
          <form onSubmit={join} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-code`}>Room code</Label>
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
              Join
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
        <Badge tone="accent">server-authoritative</Badge>
      </p>
    </main>
  );
}
