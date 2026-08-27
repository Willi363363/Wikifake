/** @vitest-environment jsdom */

// One chat, and the criterion of the step: what was said in the lobby is still
// readable during the round.
//
// The transition is driven the way the server drives it — a `game_start`
// delivered on the socket — and the chat is mounted the way the layout mounts
// it, beside the screen rather than inside it. That composition *is* the step:
// mounted inside `Room`, every test below still passes except the one that
// matters.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MAX_CHAT_LENGTH, type OutgoingMessage } from '@wikifake/protocol';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ChatDock } from './chat.js';
import { RealtimeProvider, useRealtimeMessages } from '../realtime/provider.js';
import { installFakeSocket, opened } from '../realtime/testing.js';
import type { FakeSocket } from '../realtime/testing.js';

let uninstall: () => void;

beforeEach(() => {
  uninstall = installFakeSocket();
});
afterEach(() => {
  cleanup();
  uninstall();
});

const HERE = dirname(fileURLToPath(import.meta.url));

/** The socket the provider opened, which a test then drives as the server. */
function socket(): FakeSocket {
  const held = opened[0];
  if (held === undefined) throw new Error('the provider opened no socket');
  return held;
}

/**
 * A screen that swaps its whole subtree when the round starts.
 *
 * Two different components at one position, which is what the lobby and the
 * round are: React unmounts one and mounts the other, and anything mounted
 * *inside* goes with it. Modelled here rather than driven through the real
 * `Room`, so what the test is about — where the chat is mounted — is the only
 * thing in it.
 */
function Screen({ children }: { children?: ReactNode }) {
  const [round, setRound] = useState(false);
  useRealtimeMessages((message) => {
    if (message.type === 'game_start') setRound(true);
  });

  const Lobby = ({ inside }: { inside?: ReactNode }) => (
    <section>
      <p>the lobby</p>
      {inside}
    </section>
  );
  const Round = ({ inside }: { inside?: ReactNode }) => (
    <article>
      <p>the round</p>
      {inside}
    </article>
  );

  return round ? <Round inside={children} /> : <Lobby inside={children} />;
}

/** The server starting the round, in the shape the protocol says. */
const ROUND_BEGINS: OutgoingMessage = {
  type: 'game_start',
  topic: 'Chat',
  paragraphs: ['Le chat dort.', 'Sa vision nocturne est bonne.'],
  totalFakes: 1,
  wikipediaUrl: 'https://fr.wikipedia.org/wiki/Chat',
  players: [{ name: 'ada', colour: '#e63946' }],
  withItems: false,
  timeLimit: 300,
};

/** Mounts the dock the way the layout does: inside the provider, beside a screen. */
function mount(nickname: string | null = 'ada', children: ReactNode = null) {
  const view = render(
    <RealtimeProvider roomCode="A1B2C3" playerName={nickname}>
      {children}
      <ChatDock />
    </RealtimeProvider>,
  );
  if (nickname !== null) {
    act(() => {
      socket().accept();
    });
  }
  return view;
}

const say = (sender: string, content: string): OutgoingMessage => ({
  type: 'chat_message',
  sender,
  content,
});

const deliver = (message: OutgoingMessage): void => {
  act(() => {
    socket().deliver(message);
  });
};

const openIt = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /^Open the room chat/ }));
};

const type = (text: string): void => {
  fireEvent.change(screen.getByLabelText('Your message'), { target: { value: text } });
};

describe('7.7 — the chat, where there is no room', () => {
  it('shows nothing at all', () => {
    // `/play` and `/solo` are inside the `(game)` group too, and there is nobody
    // to talk to on either.
    render(
      <RealtimeProvider roomCode={null} playerName={null}>
        <ChatDock />
      </RealtimeProvider>,
    );
    expect(screen.queryByRole('button', { name: /room chat/ })).toBeNull();
    expect(screen.queryByLabelText('Your message')).toBeNull();
  });
});

describe('7.7 — the chat, in a room', () => {
  it('starts as a handle, not as a panel over the game', () => {
    mount();
    expect(screen.getByRole('button', { name: 'Open the room chat' })).not.toBeNull();
    expect(screen.queryByLabelText('Your message')).toBeNull();
  });

  it('opens and closes from the keyboard, because it is a button', () => {
    mount();
    openIt();
    expect(screen.getByLabelText('Your message')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close the room chat' }));
    expect(screen.getByRole('button', { name: 'Open the room chat' })).not.toBeNull();
  });

  it('shows what the room said, and who said it', () => {
    mount();
    openIt();
    deliver(say('bob', 'anyone seen paragraph four'));

    expect(screen.getByText('anyone seen paragraph four')).not.toBeNull();
    expect(screen.getByText('bob')).not.toBeNull();
  });

  it('tells your own lines apart from everyone else’s', () => {
    mount('ada');
    openIt();
    deliver(say('ada', 'mine'));
    deliver(say('bob', 'theirs'));

    // The server echoes your own line back like any other, so the client has to
    // know which name is its own — which is why the provider exposes it.
    expect(screen.getByText('you')).not.toBeNull();
    expect(screen.getByText('bob')).not.toBeNull();
  });

  it('says so when nothing has been said', () => {
    mount();
    openIt();
    expect(screen.getByText('Nothing said yet.')).not.toBeNull();
  });
});

describe('7.7 — sending', () => {
  it('sends what was typed, and clears the field', () => {
    mount();
    openIt();
    type('hello');
    fireEvent.submit(screen.getByLabelText('Your message'));

    expect(socket().sent).toEqual([{ type: 'chat_message', content: 'hello' }]);
    expect(screen.getByLabelText('Your message')).toHaveProperty('value', '');
  });

  it('sends on enter, and breaks a line on shift+enter', () => {
    mount();
    openIt();
    type('one');
    fireEvent.keyDown(screen.getByLabelText('Your message'), { key: 'Enter' });
    expect(socket().sent).toHaveLength(1);

    type('two');
    fireEvent.keyDown(screen.getByLabelText('Your message'), {
      key: 'Enter',
      shiftKey: true,
    });
    expect(socket().sent).toHaveLength(1);
  });

  it('sends nothing for a message that is only spaces', () => {
    mount();
    openIt();
    type('   ');
    fireEvent.keyDown(screen.getByLabelText('Your message'), { key: 'Enter' });

    expect(socket().sent).toEqual([]);
    expect(screen.getByRole('alert')).not.toBeNull();
  });

  it('trims what it sends', () => {
    mount();
    openIt();
    type('  spaced  ');
    fireEvent.keyDown(screen.getByLabelText('Your message'), { key: 'Enter' });

    expect(socket().sent).toEqual([{ type: 'chat_message', content: 'spaced' }]);
  });

  // C5.4, and the completion criterion of the step.
  describe('the 400-character bound', () => {
    it('stops the field at the cap', () => {
      mount();
      openIt();
      expect(screen.getByLabelText('Your message').getAttribute('maxlength')).toBe(
        String(MAX_CHAT_LENGTH),
      );
    });

    it('sends a message of exactly the cap', () => {
      mount();
      openIt();
      type('x'.repeat(MAX_CHAT_LENGTH));
      fireEvent.keyDown(screen.getByLabelText('Your message'), { key: 'Enter' });

      expect(socket().sent).toHaveLength(1);
    });

    it('refuses one past it, whatever put it there', () => {
      mount();
      openIt();
      // `maxLength` is the browser's guard and jsdom does not apply it, which
      // is convenient: this is the paste, the autofill and the extension that
      // get around it in a real browser too. The schema is the guard that holds.
      type('x'.repeat(MAX_CHAT_LENGTH + 1));
      fireEvent.keyDown(screen.getByLabelText('Your message'), { key: 'Enter' });

      expect(socket().sent).toEqual([]);
      expect(screen.getByRole('alert')).not.toBeNull();
    });

    it('counts down once the cap is in sight', () => {
      mount();
      openIt();
      expect(screen.queryByText(new RegExp(`/${String(MAX_CHAT_LENGTH)}$`))).toBeNull();

      type('x'.repeat(MAX_CHAT_LENGTH - 10));
      expect(screen.getByText(new RegExp(`/${String(MAX_CHAT_LENGTH)}$`))).not.toBeNull();
    });
  });
});

describe('7.7 — unread', () => {
  it('counts what arrived while the panel was shut', () => {
    mount();
    deliver(say('bob', 'one'));
    deliver(say('bob', 'two'));

    expect(
      screen.getByRole('button', { name: 'Open the room chat, 2 unread' }),
    ).not.toBeNull();
  });

  it('clears the count on opening, and keeps the lines', () => {
    mount();
    deliver(say('bob', 'one'));
    openIt();

    expect(screen.getByText('one')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close the room chat' }));
    expect(screen.getByRole('button', { name: 'Open the room chat' })).not.toBeNull();
  });

  it('counts nothing while the panel is open', () => {
    mount();
    openIt();
    deliver(say('bob', 'one'));
    fireEvent.click(screen.getByRole('button', { name: 'Close the room chat' }));

    expect(screen.getByRole('button', { name: 'Open the room chat' })).not.toBeNull();
  });
});

describe('7.7 — the criterion: the history survives the round starting', () => {
  it('keeps what was said in the lobby readable during the round', () => {
    mount('ada', <Screen />);
    openIt();
    deliver(say('bob', 'said in the lobby'));
    expect(screen.getByText('said in the lobby')).not.toBeNull();

    deliver(ROUND_BEGINS);
    // The screen really was replaced — otherwise the assertion below proves
    // nothing at all.
    expect(screen.getByText('the round')).not.toBeNull();
    expect(screen.getByText('said in the lobby')).not.toBeNull();
  });

  // The same tree with the chat *inside* the screen, which is where the current
  // game mounts it. Every other test in this file passes either way; this is the
  // one that does not, and it is the whole reason the step exists.
  it('loses the history when a screen owns it, which is today', () => {
    render(
      <RealtimeProvider roomCode="A1B2C3" playerName="ada">
        <Screen>
          <ChatDock />
        </Screen>
      </RealtimeProvider>,
    );
    act(() => {
      socket().accept();
    });
    openIt();
    deliver(say('bob', 'said in the lobby'));
    expect(screen.getByText('said in the lobby')).not.toBeNull();

    deliver(ROUND_BEGINS);
    expect(screen.getByText('the round')).not.toBeNull();
    // A new instance, collapsed and empty: nothing was lost on the server, the
    // client threw it away and opened a second panel.
    openIt();
    expect(screen.getByText('Nothing said yet.')).not.toBeNull();
  });

  it('goes on receiving once the round has started', () => {
    mount('ada', <Screen />);
    openIt();
    deliver(ROUND_BEGINS);
    deliver(say('bob', 'said during the round'));

    expect(screen.getByText('said during the round')).not.toBeNull();
  });

  // The step is about *where* it is mounted, and a component moved into a screen
  // passes almost every test above while losing the only thing that matters.
  it('is mounted in the layout of the (game) group', () => {
    const layout = readFileSync(
      join(HERE, '..', '..', 'app', '(game)', 'layout.tsx'),
      'utf8',
    );
    expect(layout).toContain('<ChatDock />');
  });

  it('is mounted in no screen', () => {
    for (const file of ['room.tsx', 'room-screen.tsx', 'entry.tsx', 'generation.tsx']) {
      const source = readFileSync(join(HERE, '..', 'lobby', file), 'utf8');
      expect(source).not.toContain('ChatDock');
    }
  });
});
