// Persistence: the schema, the client, and the queries that read them.
//
// No business logic. `participant` stores the breakdown `domain` computed; it
// does not recompute it, and there is no trigger and no stored procedure. The
// rules live in one place, and it is not the database.
export * from './schema/index.js';
export { connect, connectFromEnv } from './client.js';
export {
  selectAnswers,
  selectGameInProgress,
  selectLeaderboard,
  selectParticipantsInProgress,
  selectSolution,
  IN_PROGRESS_QUERIES,
} from './queries/game.js';
export type { ConnectionOptions, Database } from './client.js';
export {
  isMonotonic,
  selectHintPurchases,
  selectItemUses,
  selectReportsToReview,
} from './queries/audit.js';
export {
  readUsageTotals,
  selectCallsByKind,
  selectCostOfGame,
  selectFailuresByKind,
  selectGameCounts,
  usageReport,
} from './queries/usage.js';
export type { UsageReport, UsageTotals } from './queries/usage.js';
