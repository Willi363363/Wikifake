// The game rules, pure: scoring, grading, item catalogue and effects, and the
// room state machine as a reducer.
//
// Nothing here reads the clock, the network or the disk: time is a parameter and
// effects are returned as data. That is what makes a round-end-by-timeout
// testable without waiting five minutes, and what lets phase 5 wire the same
// effects onto BullMQ.
//
// Grading, items and the reducer arrive with steps 1.6 to 1.9 of
// plans/rewrite/phase-01-core.md.
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
