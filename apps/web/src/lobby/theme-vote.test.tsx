/** @vitest-environment jsdom */

// The vote decides nothing on this screen.
//
// The criterion is one sentence — "the theme displayed as elected is the one
// from the server message, never a local tally" — and the current screen breaks
// a smaller version of it before the election is even reached: it sets a local
// `submitted` flag the moment the form is sent. A ballot the server refused,
// because the vote had closed or the socket was already down, still reads as
// submitted, and the player waits for a vote they are not in.
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OutgoingMessage } from '@wikifake/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Room } from './room.js';
import { RealtimeProvider } from '../realtime/provider.js';
import { installFakeSocket, opened } from '../realtime/testing.js';
import type { FakeSocket } from '../realtime/testing.js';

let uninstall: () => void;

beforeEach(() => {
  uninstall = installFakeSocket();
  globalThis.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  uninstall();
});

const live = (): FakeSocket => opened.at(-1) as FakeSocket;

const player = (name: string, isHost = false) => ({
  name,
  colour: '#e63946',
  connected: true,
  ready: true,
  answered: false,
  isHost,
});

function mount(nickname = 'ada') {
  render(
    <RealtimeProvider roomCode="A1B2C3" playerName={nickname}>
      <Room roomCode="A1B2C3" nickname={nickname} />
    </RealtimeProvider>,
  );
  act(() => {
    live().accept();
  });
}

const deliver = (...messages: OutgoingMessage[]) => {
  act(() => {
    for (const message of messages) live().deliver(message);
  });
};

const OPEN_VOTE: OutgoingMessage = { type: 'theme_vote_start' };

/**
 * A round has at least one falsification, and the contract says so: `solution`
 * is `.min(1)`. An empty one is refused by the decoder — which is the provider
 * behaving correctly, and is how this fixture came to be written properly.
 */
const ENDED: OutgoingMessage = {
  type: 'game_end',
  leaderboard: [],
  solution: [
    {
      paragraphIndex: 1,
      falseInfoNumber: 1,
      falseStatement: 'Le chat dort seize heures par jour.',
      explanation: 'Il en dort environ quatre.',
      hint: 'Vérifiez ce nombre.',
    },
  ],
};

describe('7.4 — the topic vote', () => {
  it('replaces the lobby when the server opens the vote', () => {
    mount();
    deliver({ type: 'lobby_update', players: [player('ada', true), player('bob')] });
    expect(screen.getByText('Players (2)')).not.toBeNull();

    deliver(OPEN_VOTE);
    expect(screen.queryByText('Players (2)')).toBeNull();
    expect(screen.getByText('Pick a topic')).not.toBeNull();
  });

  it('sends the topic the player proposed', async () => {
    const user = userEvent.setup();
    mount();
    deliver(OPEN_VOTE);

    await user.type(screen.getByLabelText('Your topic'), 'Chat');
    await user.click(screen.getByRole('button', { name: 'Propose it' }));

    expect(live().sent).toContainEqual({ type: 'submit_theme', topic: 'Chat' });
  });

  it('refuses an empty topic without sending anything', async () => {
    const user = userEvent.setup();
    mount();
    deliver(OPEN_VOTE);

    await user.click(screen.getByRole('button', { name: 'Propose it' }));
    expect(live().sent).toEqual([]);
    expect(screen.getByRole('alert')).not.toBeNull();
  });

  // The heart of the step. Pressing submit is not the same as having voted.
  describe('"you have voted" is the server\'s answer', () => {
    it('still offers the form after the message is sent', async () => {
      const user = userEvent.setup();
      mount();
      deliver(OPEN_VOTE);

      await user.type(screen.getByLabelText('Your topic'), 'Chat');
      await user.click(screen.getByRole('button', { name: 'Propose it' }));

      // Sent, and not yet counted. The current screen says "Thème soumis" here.
      expect(screen.getByLabelText('Your topic')).not.toBeNull();
      expect(screen.queryByText('your ballot is in')).toBeNull();
    });

    it('confirms once the server counts the ballot', () => {
      mount();
      deliver(OPEN_VOTE, {
        type: 'theme_vote_update',
        submitted: ['ada'],
        total: 2,
      });

      expect(screen.getByText('your ballot is in')).not.toBeNull();
      expect(screen.queryByLabelText('Your topic')).toBeNull();
    });

    it('does not confirm for somebody else’s ballot', () => {
      mount('bob');
      deliver(OPEN_VOTE, {
        type: 'theme_vote_update',
        submitted: ['ada'],
        total: 2,
      });

      expect(screen.queryByText('your ballot is in')).toBeNull();
      expect(screen.getByLabelText('Your topic')).not.toBeNull();
    });

    it('shows the tally the server sent', () => {
      mount();
      deliver(OPEN_VOTE, {
        type: 'theme_vote_update',
        submitted: ['ada', 'bob'],
        total: 3,
      });

      expect(screen.getByText('2 of 3 have voted')).not.toBeNull();
      expect(
        screen
          .getByRole('progressbar', { name: 'Ballots in' })
          .getAttribute('aria-valuenow'),
      ).toBe('2');
    });
  });

  describe('C1.7 — drawing early is the host’s', () => {
    it('offers it to the host once a ballot is in', () => {
      mount();
      deliver(OPEN_VOTE, { type: 'lobby_update', players: [player('ada', true)] });
      expect(screen.queryByRole('button', { name: 'Draw now' })).toBeNull();

      deliver({ type: 'theme_vote_update', submitted: ['ada'], total: 1 });
      expect(screen.getByRole('button', { name: 'Draw now' })).not.toBeNull();
    });

    it('does not offer it to a guest', () => {
      mount('bob');
      deliver(
        OPEN_VOTE,
        { type: 'lobby_update', players: [player('ada', true), player('bob')] },
        { type: 'theme_vote_update', submitted: ['ada'], total: 2 },
      );

      expect(screen.queryByRole('button', { name: 'Draw now' })).toBeNull();
    });
  });

  // The criterion, stated exactly.
  describe('the elected topic', () => {
    it('is the one the server named, whatever was proposed here', async () => {
      const user = userEvent.setup();
      mount();
      deliver(OPEN_VOTE);

      await user.type(screen.getByLabelText('Your topic'), 'Chien');
      await user.click(screen.getByRole('button', { name: 'Propose it' }));

      deliver({
        type: 'theme_selected',
        topic: 'Chat',
        proposer: 'bob',
        ballots: { ada: 'Chien', bob: 'Chat' },
      });

      expect(screen.getByText('Chat')).not.toBeNull();
      expect(screen.getByText('proposed by bob')).not.toBeNull();
      // The topic this player typed is nowhere on screen.
      expect(screen.queryByText('Chien')).toBeNull();
    });

    // `proposer: null` means no ballot decided it — the server fell back. The
    // current server sends the string "Système" there, which is both a magic
    // value and the last French string on the wire.
    it('says the server drew it when no ballot decided', () => {
      mount();
      deliver(OPEN_VOTE, {
        type: 'theme_selected',
        topic: 'Paris',
        proposer: null,
        ballots: {},
      });

      expect(screen.getByText('drawn by the server')).not.toBeNull();
      expect(screen.queryByText(/Syst/)).toBeNull();
    });

    it('leaves the vote behind once a topic is elected', () => {
      mount();
      deliver(OPEN_VOTE, {
        type: 'theme_selected',
        topic: 'Chat',
        proposer: 'ada',
        ballots: { ada: 'Chat' },
      });

      expect(screen.queryByText('Pick a topic')).toBeNull();
    });
  });

  // C1.2 — the round ends and the vote is over. Since step 8.7 what follows is
  // the debrief rather than the lobby: the room goes back when the player says
  // so. The transition itself is `room-round.test.tsx`.
  it('closes the vote when the round ends', () => {
    mount();
    deliver(
      { type: 'lobby_update', players: [player('ada', true)] },
      OPEN_VOTE,
      { type: 'theme_selected', topic: 'Chat', proposer: 'ada', ballots: {} },
      ENDED,
    );

    expect(screen.queryByText('Pick a topic')).toBeNull();
  });
});
