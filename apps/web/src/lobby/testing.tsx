// The harness the room's tests share.
//
// Extracted when `room.test.tsx` crossed the 500-line cap and had to split: the
// pieces below were defined once and used by every suite in it, and copying them
// into the second file is how two harnesses start disagreeing about what a
// player looks like.
//
// It builds messages and drives a fake socket. Nothing here asserts anything.
import { act, render } from '@testing-library/react';
import type { OutgoingMessage } from '@wikifake/protocol';

import { Room } from './room.js';
import { RealtimeProvider } from '../realtime/provider.js';
import { opened } from '../realtime/testing.js';
import type { FakeSocket } from '../realtime/testing.js';

/** One player, as `lobby_update` carries them. Defaults to a connected guest. */
export const player = (
  name: string,
  extra: Partial<{
    colour: string;
    connected: boolean;
    ready: boolean;
    answered: boolean;
    isHost: boolean;
  }> = {},
) => ({
  name,
  colour: '#e63946',
  connected: true,
  ready: false,
  answered: false,
  isHost: false,
  ...extra,
});

export const roster = (...players: ReturnType<typeof player>[]): OutgoingMessage => ({
  type: 'lobby_update',
  players,
});

/**
 * The socket the mounted provider is using — the last one opened, not the first.
 *
 * A test that mounts twice leaves the first behind in `opened`, and driving that
 * one delivers to a component nobody is rendering.
 */
export const live = (): FakeSocket => opened.at(-1) as FakeSocket;

/** What the client has sent, parsed. */
export const sent = () => live().sent;

export const deliver = (message: OutgoingMessage): void => {
  act(() => {
    live().deliver(message);
  });
};

/** A mounted room, on an accepted socket. */
export function mountRoom(nickname = 'ada') {
  const view = render(
    <RealtimeProvider roomCode="A1B2C3" playerName={nickname}>
      <Room roomCode="A1B2C3" nickname={nickname} />
    </RealtimeProvider>,
  );
  act(() => {
    live().accept();
  });
  return view;
}

/** The three paragraphs every round fixture in these suites is built on. */
export const PARAGRAPHS = [
  'Le chat dort seize heures par jour.',
  'Sa vision nocturne est bonne.',
  'Il ronronne en expirant.',
];

/**
 * A round the server has started. `timeLimit` is deliberately not the default.
 *
 * Typed as the member and not as the union: spreading a union value widens it to
 * "any member plus these fields", which the compiler then refuses.
 */
export const ROUND_BEGINS: Extract<OutgoingMessage, { type: 'game_start' }> = {
  type: 'game_start',
  topic: 'Chat',
  paragraphs: PARAGRAPHS,
  totalFakes: 2,
  wikipediaUrl: 'https://fr.wikipedia.org/wiki/Chat',
  players: [{ name: 'ada', colour: '#e63946' }],
  withItems: true,
  timeLimit: 120,
};

/** A wave of items, keyed by nickname as the message is. */
export const wave = (
  items: Record<string, { instanceId: string; itemId: string }>,
  at = 1,
): OutgoingMessage =>
  ({
    type: 'items_distributed',
    wave: at,
    items,
  }) as OutgoingMessage;

/** A round the server has ended. `solution` is `.min(1)`, so it carries one. */
export const ROUND_ENDS: Extract<OutgoingMessage, { type: 'game_end' }> = {
  type: 'game_end',
  leaderboard: [{ player: 'ada', colour: '#e63946', score: 150, breakdown: null }],
  solution: [
    {
      paragraphIndex: 1,
      falseInfoNumber: 1,
      falseStatement: 'Le chat dort seize heures par jour.',
      explanation: 'Il en dort douze.',
      hint: 'Regardez la durée.',
    },
  ],
};
