'use client';

// Play alone, open a room, or join one — the largest tile of the home.
//
// **L.6 made it a tile rather than a screen.** It was a centred card on an
// otherwise empty page, with the brand above it and two links under it; the
// owner's dashboard puts it in a grid beside the figures, so this component
// stopped owning a `<main>` and owns the tile. `home.tsx` is the page.
//
// It is the accent block, and it is two rows and two columns wide, because *Play
// is the largest tile* is the decision the arrangement was chosen for: it earns
// the eye by area and position rather than by glowing.
//
// Everything on the fill carries `on-fill`, which is a measured pair. The fields
// are `surface`, so what a player types is `ink` on white in both palettes — an
// input tinted to match the tile would be a field whose text nothing measured.
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
import { Button, cn, Input } from '@wikifake/ui';
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

export interface LobbyEntryProps {
  /**
   * The name this player is shown under in a room — step E.3.3.
   *
   * Present exactly when an account has chosen one, so its presence is what
   * decides whether the nickname field is offered at all. A signed-in player is
   * not asked, because there is nothing to ask: the room will show them their
   * pseudonym whatever they type, and a field whose value is discarded is a
   * field that lies.
   *
   * From the server for the same reason `signedIn` is. It is belt to the
   * server's braces rather than the guarantee itself — `/api/realtime/ticket`
   * substitutes the pseudonym whatever a browser asks for — so a stale render
   * here is a cosmetic problem and not an identity one.
   */
  readonly pseudonym?: string;
}

export function LobbyEntry({ pseudonym }: LobbyEntryProps) {
  const t = useTranslations('lobby.entry');
  const router = useRouter();
  const ids = useId();

  const [mode, setMode] = useState<Mode>('solo');
  const [nickname, setNickname] = useState('');
  const [topic, setTopic] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validates, remembers, and hands back the trimmed name — or null.
   *
   * A pseudonym short-circuits the whole thing: there is no field to read and
   * nothing a player could have typed wrong. It is still *remembered*, because
   * the gate reads `sessionStorage` before it has an answer from the server and
   * a room opened with the wrong name for one render is a room the player sees
   * themselves renamed in.
   */
  const acceptNickname = (): string | null => {
    if (pseudonym !== undefined) {
      rememberNickname(pseudonym);
      return pseudonym;
    }

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

  // Step E.3.3 — a signed-in player is told their name rather than asked for
  // one. A room shows them their pseudonym and nothing else, so a text box here
  // would be collecting a value the server is about to overrule.
  const nicknameField =
    pseudonym === undefined ? (
      <div className="flex flex-col gap-1.5">
        {/* Not the design system's `Label`, which is `ink`: this one sits on
            the accent fill, where `on-fill` is the measured pair. */}
        <label htmlFor={`${ids}-nickname`} className="text-[13px] font-medium">
          {t('nicknameLabel')}
        </label>
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
    ) : (
      <p className="m-0 text-sm">
        {t.rich('playingAs', {
          name: () => <span className="font-mono font-semibold">{pseudonym}</span>,
        })}
      </p>
    );

  return (
    <section className="flex flex-col gap-5 rounded-xl bg-accent p-6 text-on-fill sm:col-span-2 sm:row-span-2">
      <p className="m-0 text-[15px] leading-snug font-medium">{t('tagline')}</p>

      {/* A tablist, not three buttons that happen to look like one: the roles
          are what let a keyboard move between them. */}
      <div role="tablist" aria-label={t('tabsLabel')} className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={mode === tab}
            onClick={() => {
              setMode(tab);
              setError(null);
            }}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-[13px] font-semibold',
              'transition-colors outline-none motion-reduce:transition-none',
              'focus-visible:ring-[3px] focus-visible:ring-accent-line focus-visible:ring-offset-2 focus-visible:ring-offset-accent',
              // The chosen one is a surface on the fill; the others are the fill
              // with the text on it. Never a border — there are none here.
              mode === tab
                ? 'bg-surface text-ink'
                : 'text-on-fill hover:bg-bg-grain hover:text-ink',
            )}
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>

      {mode === 'solo' ? (
        <form onSubmit={startSolo} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-topic`} className="text-[13px] font-medium">
              {t('topicLabel')}
            </label>
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
          <Submit label={t('playSolo')} />
        </form>
      ) : null}

      {mode === 'host' ? (
        <form
          onSubmit={(event) => {
            void host(event);
          }}
          className="flex flex-col gap-4"
        >
          {nicknameField}
          <Submit label={busy ? t('opening') : t('openRoom')} disabled={busy} />
        </form>
      ) : null}

      {mode === 'join' ? (
        <form onSubmit={join} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-code`} className="text-[13px] font-medium">
              {t('roomCodeLabel')}
            </label>
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
          <Submit label={t('joinSubmit')} />
        </form>
      ) : null}

      {error === null ? null : (
        // `role="alert"`, so it is announced rather than merely displayed —
        // the current one is a red paragraph and nothing else.
        <p
          role="alert"
          className="m-0 rounded-lg bg-danger-soft px-3 py-2 text-center text-sm text-ink"
        >
          {error}
        </p>
      )}

      {/* Last, and small: the guarantee is reassurance rather than an
          instruction, and on the largest tile of the page it was competing with
          the thing the tile is for. */}
      <p className="m-0 mt-auto text-[11.5px]">{t('serverAuthoritative')}</p>
    </section>
  );
}

/**
 * The one control that starts something, on the accent tile.
 *
 * `default` rather than `primary`: the primary variant *is* the accent, and an
 * accent button on an accent tile is a rectangle you find by hovering. The
 * recessed ground reads as a raised control against the fill, which is the same
 * inversion the tile itself is built on.
 */
function Submit({
  label,
  disabled,
}: {
  readonly label: string;
  readonly disabled?: boolean;
}) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={disabled ?? false}>
      {label}
    </Button>
  );
}
