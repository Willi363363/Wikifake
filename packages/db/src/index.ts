// Persistence: the schema, the client, and the queries that read them.
//
// No business logic. `participant` stores the breakdown `domain` computed; it
// does not recompute it, and there is no trigger and no stored procedure. The
// rules live in one place, and it is not the database.
export * from './schema/index.js';
export { connect, connectFromEnv } from './client.js';
export { requireDatabaseUrl } from './database-url.js';
export {
  selectAnswers,
  selectGameInProgress,
  selectLeaderboard,
  selectParticipantsInProgress,
  selectSolution,
  IN_PROGRESS_QUERIES,
} from './queries/game.js';
export { createGame } from './queries/start.js';
export { insertRoom, selectOpenRoomCount, selectRoom } from './queries/rooms.js';
export {
  recordHintPurchase,
  recordScan,
  recordSubmission,
  selectFalsifiedIndices,
  selectHintFor,
  selectParticipantFor,
  selectRoundStatus,
  selectScannedParagraphs,
} from './queries/session.js';
export type { BilledHint, GradedSubmission } from './queries/session.js';
export type {
  NewGame,
  NewParticipant,
  NewPosition,
  StartedGame,
} from './queries/start.js';
export type { ConnectionOptions, Database } from './client.js';
export { selectUserById } from './queries/users.js';
export {
  attachGuestRecords,
  selectGameHistory,
  selectOtherParticipants,
  selectPlayedGameIds,
  HISTORY_QUERIES,
} from './queries/history.js';
export type { Attachment } from './queries/history.js';
export {
  isMonotonic,
  selectHintPurchases,
  selectItemUses,
  selectReportsToReview,
} from './queries/audit.js';
export {
  readUsageByKind,
  readUsageTotals,
  recordLlmCalls,
  selectCallsByKind,
  selectCostOfGame,
  selectFailuresByKind,
  selectGameCounts,
  usageReport,
} from './queries/usage.js';
export type { CallCounter, UsageReport, UsageTotals } from './queries/usage.js';
export { seed } from './seed/seed.js';
