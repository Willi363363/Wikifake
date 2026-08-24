// The game rules, pure: scoring, grading, item catalogue and effects, and the
// room state machine as a reducer.
//
// Nothing here reads the clock, the network or the disk: time is a parameter and
// effects are returned as data. That is what makes a round-end-by-timeout
// testable without waiting five minutes, and what lets phase 5 wire the same
// effects onto BullMQ.
//
// Grading, items and the reducer arrive with steps 1.6 to 1.9 of
// plans/rewrite/phase-01-steps-domain.md.
export { emit, settle } from './reducer.js';
export type { Reduced, Reducer } from './reducer.js';

export {
  gradeSubmission,
  hintCostFor,
  rankByScore,
  scoreFor,
  timeBonusFor,
  HINT_COST,
  PER_FALSE_POSITIVE,
  PER_TRUE_POSITIVE,
  REVEAL_COST,
  STEAL_AMOUNT,
  TIME_BONUS_PER_SECOND,
} from './scoring.js';
export type { HintLevel, Submission } from './scoring.js';

export { grantHint, hintPenaltyFor, hintsUsedFor, EMPTY_LEDGER } from './hints.js';
export type {
  HintGrant,
  HintGuard,
  HintLedger,
  HintPayload,
  HintRequest,
} from './hints.js';

export { gradeAnswer, isWellFormedSolution, solutionIssues } from './grading.js';
export type { Grading } from './grading.js';

export {
  applyItemToTarget,
  areHintsBlocked,
  scan,
  validateTargets,
  EMPTY_ITEM_STATE,
  FREEZE_TIME_SECONDS,
  HINT_BLOCK_SECONDS,
  ITEMS,
  ITEM_CATALOGUE,
} from './items.js';
export type { ItemDefinition, ItemKind, ItemState, TargetCheck } from './items.js';

export { lobbyUpdate, reduceLobby } from './room/lobby.js';
export { FALLBACK_TOPICS, selectTopic } from './room/topics.js';
export {
  assignColour,
  emptyRoom,
  hostOf,
  isHost,
  newPlayer,
  playerIn,
  DEFAULT_TIME_LIMIT,
  PLAYER_COLOURS,
} from './room/state.js';
export type {
  Generating,
  PlayerState,
  RoomOptions,
  RoomPhase,
  RoomState,
} from './room/state.js';
export type { RoomEffect, RoomEvent } from './room/events.js';
