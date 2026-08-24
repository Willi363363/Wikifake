// The shape of a room, and nothing that changes it.
//
// Serialisable throughout: phase 5 keeps this in Redis, mutated by Lua scripts,
// so no `Map`, no `Set`, no `Date`. Where the current code reaches for a clock —
// `joined_at`, to decide who becomes host — the order of the `players` array
// carries the same information and survives `JSON.stringify`.
import type { HintLedger } from '../hints.js';
import type { ItemState } from '../items.js';
import { EMPTY_LEDGER } from '../hints.js';
import { EMPTY_ITEM_STATE } from '../items.js';

/**
 * The eight colours the server hands out, in order.
 *
 * Server state rather than presentation: the colour travels in the protocol and
 * has to be stable for a player across a round. The palette itself is carried
 * over from `AVAILABLE_COLORS`.
 */
export const PLAYER_COLOURS = [
  '#e63946',
  '#f4a261',
  '#2a9d8f',
  '#264653',
  '#8338ec',
  '#ff006e',
  '#3a0ca3',
  '#fb5607',
] as const;

/**
 * Where a room is.
 *
 * `generating` is a phase rather than the `picking_theme` boolean it replaces. A
 * flag beside a state is a state the flag can contradict; a phase cannot be in
 * two at once, so the guard against a second concurrent pick is structural.
 */
export type RoomPhase = 'lobby' | 'voting' | 'generating' | 'round';

export interface PlayerState {
  readonly name: string;
  readonly colour: string;
  readonly ready: boolean;
  /** Whether they have submitted this round. Driven by step 1.9. */
  readonly answered: boolean;
  /** What the player has paid for, this round (C1.4). */
  readonly hints: HintLedger;
  /** What items have done to them, this round (C1.5, C1.6). */
  readonly items: ItemState;
}

/** The options the host controls. A guest can change neither (C1.7). */
export interface RoomOptions {
  readonly withItems: boolean;
  readonly timeLimit: number;
}

/** What a chosen topic is waiting on. */
export interface Generating {
  readonly topic: string;
  /** Who proposed it, or `null` when a fallback was used. */
  readonly proposer: string | null;
  /**
   * The candidates to try next, in order, if this one yields no article.
   *
   * Built when the topic is picked rather than looked up again later: the vote
   * is what decides the order, and by the time a generation fails the ballots
   * may no longer be there.
   */
  readonly remaining: readonly string[];
}

export interface RoomState {
  readonly phase: RoomPhase;
  /** In arrival order. The first one is the host, which is C1.8 by construction. */
  readonly players: readonly PlayerState[];
  readonly options: RoomOptions;
  /** Who voted for what, while the vote is open. */
  readonly ballots: Readonly<Record<string, string>>;
  /** Set while `phase` is `generating`, null otherwise. */
  readonly generating: Generating | null;
}

/** Default round length, from `GAME_DURATION`. */
export const DEFAULT_TIME_LIMIT = 300;

export function emptyRoom(): RoomState {
  return {
    phase: 'lobby',
    players: [],
    options: { withItems: true, timeLimit: DEFAULT_TIME_LIMIT },
    ballots: {},
    generating: null,
  };
}

/**
 * C1.8 — the host is the longest-present player.
 *
 * Derived rather than stored, so promotion is not a transition anybody can
 * forget: whoever is first in the array is the host, and removing them promotes
 * the next one by arithmetic. `promote_host` had to be called on every arrival
 * and every departure, and a path that forgot it left a room with no host.
 */
export function hostOf(state: RoomState): string | null {
  return state.players[0]?.name ?? null;
}

export function isHost(state: RoomState, player: string): boolean {
  return hostOf(state) === player;
}

export function playerIn(state: RoomState, name: string): PlayerState | undefined {
  return state.players.find((player) => player.name === name);
}

/**
 * The first unused colour, else one chosen by position.
 *
 * The current server falls back to `random.choice`, which can hand two players
 * the same colour while an unused one is right there. Cycling is deterministic
 * and no worse.
 */
export function assignColour(state: RoomState): string {
  const taken = new Set(state.players.map((player) => player.colour));
  const free = PLAYER_COLOURS.find((colour) => !taken.has(colour));
  // The modulo cannot land outside the palette, but an index expression does
  // not tell the type that — hence the last fallback rather than an assertion.
  return (
    free ??
    PLAYER_COLOURS[state.players.length % PLAYER_COLOURS.length] ??
    PLAYER_COLOURS[0]
  );
}

export function newPlayer(name: string, colour: string): PlayerState {
  return {
    name,
    colour,
    ready: false,
    answered: false,
    hints: EMPTY_LEDGER,
    items: EMPTY_ITEM_STATE,
  };
}
