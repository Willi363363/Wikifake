// The shape of a room, and nothing that changes it.
//
// Serialisable throughout: phase 5 keeps this in Redis, mutated by Lua scripts,
// so no `Map`, no `Set`, no `Date`. Where the current code reaches for a clock —
// `joined_at`, to decide who becomes host — the order of the `players` array
// carries the same information and survives `JSON.stringify`.
import type {
  ArticleView,
  FalsifiedPosition,
  ItemInstance,
  ScoreBreakdown,
} from '@wikifake/protocol';

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
  /**
   * D5 — whether their socket is up.
   *
   * The current server never sets this to false: a disconnection deletes the
   * player outright, so their score, their items and the hints they paid for go
   * with them, and their nickname is immediately claimable by a stranger. Here a
   * dropped socket leaves the player in the room, unreachable, until the grace
   * window of step 5.5 evicts them.
   */
  readonly connected: boolean;
  readonly ready: boolean;
  /** Whether they have submitted this round. Driven by step 1.9. */
  readonly answered: boolean;
  /** What the player has paid for, this round (C1.4). */
  readonly hints: HintLedger;
  /** What items have done to them, this round (C1.5, C1.6). */
  readonly items: ItemState;
  /** Unspent items. Filled by the waves of `items_granted`. */
  readonly hand: readonly ItemInstance[];
  /** Their score once they submit, absent until then. */
  readonly submission: ScoredSubmission | null;
}

/** What a submission was worth, kept until the round ends. */
export interface ScoredSubmission {
  readonly score: number;
  readonly breakdown: ScoreBreakdown;
}

/**
 * A round in progress.
 *
 * The solution sits here and is sent exactly once, with `game_end` (C1.2).
 * Nothing that reaches a player before then can reach it: `article` is the whole
 * of what the round may show.
 */
export interface RoundState {
  readonly article: ArticleView;
  readonly solution: readonly FalsifiedPosition[];
  /**
   * When the round began, in milliseconds since the epoch.
   *
   * A number rather than a clock: the rules never read one, and this survives
   * `JSON.stringify` into Redis, where every instance reads the same instant.
   * It is what makes "how long has this player been playing" answerable at all —
   * without it the reducer decides every message as though the round had just
   * begun, which blocks `HINT_LOCK` for ever and pays a full time bonus to
   * everybody.
   */
  readonly startedAt: number;
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
  /** Set while `phase` is `round`, null otherwise. */
  readonly round: RoundState | null;
}

/** Default round length, from `GAME_DURATION`. */
export const DEFAULT_TIME_LIMIT = 300;

/**
 * C5.6 — how many rooms may be open at once.
 *
 * Carried over from `MAX_ROOMS`. There it guards the memory of one process; here
 * the rooms are rows, so what it guards is the game against somebody opening
 * ten thousand of them.
 */
export const MAX_OPEN_ROOMS = 200;

/**
 * How long a room with no activity still holds its slot, in seconds.
 *
 * D4 — "no idle room has a TTL" is a defect the rewrite has to close, and phase
 * 5 closes it properly: a delayed job that reaps the room. This constant is the
 * first half of that fix, and it is named here so both halves use one number.
 *
 * Phase 4 only **reads** it: a room nobody has touched for an hour no longer
 * counts against the cap. Without that, the rooms being rows instead of
 * dictionary entries would turn a memory guard into a permanent one — the
 * two-hundredth room ever created would be the last.
 *
 * An hour, from `SESSION_TTL_SECONDS` in `solo.py`: the same order of magnitude
 * as the other thing the current code lets expire.
 */
export const ROOM_IDLE_LIMIT_SECONDS = 3600;

/**
 * D5 — how long a player whose socket dropped keeps their seat, in seconds.
 *
 * The current server has no such window, because it has no such state: a
 * disconnection deletes the player. Thirty seconds is long enough for a lift, a
 * tunnel or a laptop lid, and short enough that a room is not held open by
 * somebody who closed the tab — and it is well inside the shortest round the
 * contract allows, so a reconnection lands in the round it left.
 */
export const GRACE_SECONDS = 30;

export function emptyRoom(): RoomState {
  return {
    phase: 'lobby',
    players: [],
    options: { withItems: true, timeLimit: DEFAULT_TIME_LIMIT },
    ballots: {},
    generating: null,
    round: null,
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
    connected: true,
    ready: false,
    answered: false,
    hints: EMPTY_LEDGER,
    items: EMPTY_ITEM_STATE,
    hand: [],
    submission: null,
  };
}

/**
 * D2 — everything a round owns, back to nothing.
 *
 * The penalty leak this closes: the topic-vote path — the normal path — reset
 * `score` and `answered` and forgot `hint_levels`, `score_stolen`,
 * `hints_blocked_until` and `scanned`, so a player carried last round's
 * penalties into this one. `reset_round()` did it correctly and was called from
 * the other path, which is why `test_score_integrity.py` never saw it.
 *
 * One function, called from one place: the single round start.
 */
export function forNewRound(player: PlayerState): PlayerState {
  return {
    name: player.name,
    colour: player.colour,
    // Not reset: whether a socket is up is not a property of the round. A player
    // whose connection dropped in the debrief is still disconnected in the next
    // lobby, and their grace window is still running.
    connected: player.connected,
    ready: false,
    answered: false,
    hints: EMPTY_LEDGER,
    items: EMPTY_ITEM_STATE,
    hand: [],
    submission: null,
  };
}
