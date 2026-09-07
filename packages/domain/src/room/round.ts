// The life of a round: one way in, three ways out.
//
// D3 — one way in. The current server has two start paths that disagree on what
// they announce and on whether they block the event loop. Here a round begins
// only when `article_ready` arrives, whichever path asked for the article.
//
// D2 — and that one way purges. The topic-vote path reset `score` and `answered`
// and forgot the penalties, so a player carried last round's hint bill into this
// one. One reset function, one call site.
//
// D4 — three ways out: everyone submitted, the clock ran out, or the last player
// who had not submitted left. The current server only implements the first, so a
// round nobody finishes stays open for ever.
import type {
  ArticleView,
  FalsifiedPosition,
  ItemInstance,
  OutgoingMessage,
} from '@wikifake/protocol';

import { gradeAnswer } from '../grading.js';
import { hintPenaltyFor, hintsUsedFor } from '../hints.js';
import { emit, settle, type Reduced } from '../reducer.js';
import { gradeSubmission, isPerfectRound, rankByScore } from '../scoring.js';
import type { RecordedResult, RoomEffect } from './events.js';
import { lobbyUpdate } from './lobby.js';
import {
  forNewRound,
  playerIn,
  type PlayerState,
  type RoomState,
  type RoundRecord,
} from './state.js';

type Outcome = Reduced<RoomState, RoomEffect>;

/** D3 — the announcement, in the one shape the protocol allows. */
function gameStart(state: RoomState, article: ArticleView): OutgoingMessage {
  return {
    type: 'game_start',
    ...article,
    players: state.players.map((player) => ({
      name: player.name,
      colour: player.colour,
    })),
    withItems: state.options.withItems,
    timeLimit: state.options.timeLimit,
  };
}

/**
 * D3, D2 — the single round start.
 *
 * Every player is rebuilt from `forNewRound`, so there is no field a new path
 * could forget: adding one to `PlayerState` without deciding what a fresh round
 * does with it fails to compile.
 */
export function startRound(
  state: RoomState,
  article: ArticleView,
  solution: readonly FalsifiedPosition[],
  startedAt: number,
  record: RoundRecord | null,
): Outcome {
  const next: RoomState = {
    ...state,
    phase: 'round',
    players: state.players.map(forNewRound),
    ballots: {},
    generating: null,
    round: { article, solution, startedAt, record },
  };

  return emit<RoomState, RoomEffect>(
    next,
    { kind: 'broadcast', message: gameStart(next, article) },
    // D4 — armed at the start, so the round has an end even if nobody submits.
    { kind: 'arm_timer', seconds: state.options.timeLimit },
  );
}

/**
 * C3.7 — the article could not be produced: try the next candidate.
 *
 * The queue was built when the topic was picked. When it runs out the room goes
 * back to the lobby with a code, where the current server broadcasts a French
 * sentence with no code and leaves the phase behind.
 */
export function articleFailed(state: RoomState): Outcome {
  const [next, ...rest] = state.generating?.remaining ?? [];

  if (next === undefined) {
    return emit(
      { ...state, phase: 'lobby', generating: null },
      {
        kind: 'broadcast',
        message: {
          type: 'error',
          code: 'generation_failed',
          message: 'no topic could be turned into a round',
        },
      },
    );
  }

  return emit<RoomState, RoomEffect>(
    {
      ...state,
      generating: { topic: next, proposer: null, remaining: rest },
    },
    {
      kind: 'broadcast',
      message: { type: 'theme_selected', topic: next, proposer: null, ballots: {} },
    },
    { kind: 'generate_article', topic: next },
  );
}

type GameEnd = Extract<OutgoingMessage, { type: 'game_end' }>;

/** The standings, highest first (C2.4). A player who never submitted scores 0. */
function leaderboard(state: RoomState): GameEnd['leaderboard'] {
  return rankByScore(
    state.players.map((player) => ({
      player: player.name,
      colour: player.colour,
      score: player.submission?.score ?? 0,
      breakdown: player.submission?.breakdown ?? null,
    })),
  );
}

/**
 * C1.2 — the round ends, and this is the only place the solution goes out.
 *
 * `ready` is cleared so the lobby starts from a clean slate, as the current
 * server does.
 */
/**
 * Step E.3b.1 — what the round is written down as.
 *
 * One entry per player who **submitted**, and none for anybody who did not.
 * The leaderboard shows them a zero, and that is a display rule (C2.4) rather
 * than a result: `participant_score_with_submission` forbids a score without a
 * submission, and writing the zero down would turn "did not answer" into
 * "answered and scored nothing" — a different thing, and the one a profile
 * would then count as a finished round.
 *
 * Empty when the round was never given rows to write to, which is what makes
 * the effect safe to emit unconditionally: a service handed nothing writes
 * nothing.
 */
function resultsOf(state: RoomState, totalFakes: number): RecordedResult[] {
  const record = state.round?.record;
  if (record === undefined || record === null) return [];

  return state.players.flatMap((player) => {
    const participantId = record.participants[player.name];
    const submission = player.submission;
    if (participantId === undefined || submission === null) return [];

    return [
      {
        participantId,
        marked: submission.marked,
        score: submission.score,
        breakdown: submission.breakdown,
        // The rule, asked where the round is graded — the same place the solo
        // path asks it, and the reason `@wikifake/db` never has to.
        perfect: isPerfectRound({
          truePositives: submission.breakdown.truePositives,
          falsePositives: submission.breakdown.falsePositives,
          totalFakes,
        }),
      },
    ];
  });
}

export function endRound(state: RoomState): Outcome {
  const solution = state.round?.solution;
  if (solution === undefined) return settle(state);

  const gameId = state.round?.record?.gameId ?? null;
  const results = resultsOf(state, solution.length);

  const next: RoomState = {
    ...state,
    phase: 'lobby',
    round: null,
    players: state.players.map((player) => ({ ...player, ready: false })),
  };

  return emit<RoomState, RoomEffect>(
    next,
    ...(gameId === null ? [] : [{ kind: 'record_results', gameId, results } as const]),
    { kind: 'cancel_timer' },
    {
      kind: 'broadcast',
      message: {
        type: 'game_end',
        leaderboard: leaderboard(state),
        solution: [...solution],
      },
    },
  );
}

function everyoneSubmitted(players: readonly PlayerState[]): boolean {
  return players.length > 0 && players.every((player) => player.answered);
}

/**
 * A submission, graded from server state.
 *
 * C1.3 — the penalties come from the player's own ledger and item state, not
 * from anything the message carried: the message has no field for them.
 * `FREEZE_TIME` is charged here, by adding the seconds it ate to the elapsed
 * time (D7).
 */
export function submitAnswer(
  state: RoomState,
  from: string,
  marked: readonly number[],
  elapsedSeconds: number,
): Outcome {
  const round = state.round;
  const player = playerIn(state, from);
  if (round === undefined || round === null || player === undefined) return settle(state);

  const grading = gradeAnswer(round.solution, marked);
  const graded = gradeSubmission({
    truePositives: grading.found.length,
    falsePositives: grading.wrong.length,
    hintsUsed: hintsUsedFor(player.hints),
    hintPenalty: hintPenaltyFor(player.hints),
    scoreStolen: player.items.scoreStolen,
    timeLimitSeconds: state.options.timeLimit,
    elapsedSeconds: elapsedSeconds + player.items.timePenaltySeconds,
  });

  const players = state.players.map((candidate) =>
    candidate.name === from
      ? // The marks travel with the score — step E.3b.1. Graded and discarded
        // until then, which is why no multiplayer round has ever filled the
        // `answer` table: a debrief could say 420 and nothing could say what
        // was marked to earn it.
        { ...candidate, answered: true, submission: { ...graded, marked } }
      : candidate,
  );
  const next: RoomState = { ...state, players };

  return everyoneSubmitted(players) ? endRound(next) : announce(next);
}

/** Taking a submission back. The score goes with it — it is recomputed on resubmit. */
export function unsubmitAnswer(state: RoomState, from: string): Outcome {
  const players = state.players.map((player) =>
    player.name === from ? { ...player, answered: false, submission: null } : player,
  );
  return announce({ ...state, players });
}

/**
 * D4 — someone left mid-round.
 *
 * If nobody who has not submitted is left, the round is over: the current server
 * leaves the room in `playing` for ever, waiting on a player who is gone.
 */
export function leaveDuringRound(state: RoomState, name: string): Outcome {
  const players = state.players.filter((player) => player.name !== name);
  if (players.length === state.players.length) return settle(state);
  if (players.length === 0) {
    return emit<RoomState, RoomEffect>(
      { ...state, players },
      { kind: 'cancel_timer' },
      { kind: 'close_room' },
    );
  }

  const next: RoomState = { ...state, players };
  return everyoneSubmitted(players) ? endRound(next) : announce(next);
}

/**
 * D4 — the clock ran out.
 *
 * Whoever has not submitted scores nothing: submitting is the act that scores,
 * and a round has to end on something the server controls.
 */
export function timerExpired(state: RoomState): Outcome {
  return state.phase === 'round' ? endRound(state) : settle(state);
}

/** A wave of items lands. The instances are drawn by the caller, not here. */
export function grantItems(
  state: RoomState,
  wave: number,
  grants: Readonly<Record<string, ItemInstance>>,
): Outcome {
  const players = state.players.map((player) => {
    const granted = grants[player.name];
    return granted === undefined
      ? player
      : { ...player, hand: [...player.hand, granted] };
  });

  return emit(
    { ...state, players },
    { kind: 'broadcast', message: { type: 'items_distributed', wave, items: grants } },
  );
}

/** The roster, re-announced. One author for that message: the lobby. */
function announce(state: RoomState): Outcome {
  return emit(state, { kind: 'broadcast', message: lobbyUpdate(state) });
}
