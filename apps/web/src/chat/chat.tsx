'use client';

// One chat, for the whole time the player is in a room.
//
// The current game mounts `ChatPanel` twice — once in `Lobby`, once in
// `GameSession` — and the two do not share a `messages` array. So the round
// starts, the lobby unmounts, and everything anyone said is gone. Nothing is
// lost on the server: the client simply threw it away and opened a second
// empty panel.
//
// Here there is one, mounted in the layout of the `(game)` group beside the
// provider of 7.1. It outlives every screen inside that group, which is what
// makes the history survive the lobby → round transition — and it is why it is
// mounted there rather than in a screen, where the next person to add a screen
// would have to remember to mount it again.
import { chatContent, decode, MAX_CHAT_LENGTH } from '@wikifake/protocol';
import { cn } from '@wikifake/ui';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { appended, type ChatLine } from './log.js';
import { useRealtime, useRealtimeMessages } from '../realtime/provider.js';

/** Past this, the counter appears — so a message that stops growing says why. */
const COUNTER_FROM = MAX_CHAT_LENGTH - 60;

export function ChatDock() {
  const { status, me, send } = useRealtime();
  const [log, setLog] = useState<readonly ChatLine[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState('');
  const [wrong, setWrong] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  // Read by the subscription, which must see whether the panel is open *now*
  // rather than whether it was open when the handler was created.
  const showing = useRef(open);
  showing.current = open;

  useRealtimeMessages((message) => {
    if (message.type !== 'chat_message') return;
    setLog((was) => appended(was, { sender: message.sender, content: message.content }));
    if (!showing.current) setUnread((was) => was + 1);
  });

  useEffect(() => {
    if (open) setUnread(0);
  }, [open, log.length]);

  useEffect(() => {
    const box = scroller.current;
    if (box === null) return;
    // The log scrolls, not the page. `scrollIntoView` on the last line moves the
    // document too when the panel is taller than a short screen, which reads as
    // the game jumping every time somebody types.
    box.scrollTop = box.scrollHeight;
  }, [log, open]);

  const post = (): void => {
    // The protocol's own schema, so the bound the server refuses on and the
    // bound this form applies cannot disagree — C5.4, in one place.
    const read = decode(chatContent, draft);
    if (!read.ok) {
      setWrong(read.issues[0] ?? 'that message cannot be sent');
      return;
    }
    setWrong(null);
    send({ type: 'chat_message', content: read.value });
    setDraft('');
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    post();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    post();
  };

  // No room, no room chat. The `(game)` group also holds the entry screen and
  // solo, where there is nobody to talk to.
  if (status === 'idle') return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        aria-label={
          unread === 0
            ? 'Open the room chat'
            : `Open the room chat, ${String(unread)} unread`
        }
        className="fixed top-1/2 right-0 z-40 flex h-28 -translate-y-1/2 items-center gap-2 rounded-l-xl border border-r-0 border-line bg-glass-strong px-2 shadow-md backdrop-blur-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="font-mono text-[11px] tracking-[0.1em] text-ink uppercase [writing-mode:vertical-rl] [transform:rotate(180deg)]">
          Chat
        </span>
        {unread === 0 ? null : (
          <span
            aria-hidden="true"
            className="absolute top-3 right-2 size-2.5 rounded-full bg-danger"
          />
        )}
      </button>
    );
  }

  return (
    <aside
      aria-label="Room chat"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-line bg-surface shadow-lg"
    >
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-base text-ink">Room chat</h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
          }}
          aria-label="Close the room chat"
          className="rounded-md px-2 py-1 text-sm text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
        >
          ✕
        </button>
      </header>

      <div
        ref={scroller}
        // A log, announced politely: a line that arrives while the player is
        // reading the article is worth a mention and not worth an interruption.
        role="log"
        aria-live="polite"
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {log.length === 0 ? (
          <p className="text-center text-sm text-muted italic">Nothing said yet.</p>
        ) : (
          log.map((line, at) => {
            const mine = me !== null && line.sender === me;
            return (
              <div
                key={at}
                className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}
              >
                <span className="px-1 font-mono text-[10px] text-muted">
                  {mine ? 'you' : line.sender}
                </span>
                <p
                  className={cn(
                    'max-w-[85%] rounded-xl px-3 py-2 text-sm break-words',
                    mine ? 'bg-accent text-surface' : 'bg-bg-grain text-ink',
                  )}
                >
                  {line.content}
                </p>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={submit} className="border-t border-line px-4 py-3">
        <textarea
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={onKeyDown}
          // C5.4, on the way in: the field stops at the cap rather than letting
          // a paragraph be typed and refused afterwards. The schema above still
          // guards what a cap cannot — a message that is only spaces.
          maxLength={MAX_CHAT_LENGTH}
          rows={2}
          aria-label="Your message"
          placeholder="Say something"
          className="w-full resize-none rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
        />
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-muted">
            Enter sends, shift+enter breaks a line
          </span>
          {draft.length < COUNTER_FROM ? null : (
            <span className="font-mono text-[11px] tabular-nums text-muted">
              {String(draft.length)}/{String(MAX_CHAT_LENGTH)}
            </span>
          )}
        </div>
        {wrong === null ? null : (
          <p role="alert" className="mt-2 text-sm text-danger">
            {wrong}
          </p>
        )}
      </form>
    </aside>
  );
}
