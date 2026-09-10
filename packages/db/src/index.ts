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
export {
  deleteRoom,
  insertRoom,
  selectGamesInRoom,
  selectOpenRoomCount,
  selectRoom,
} from './queries/rooms.js';
export {
  insertFlagReport,
  selectFlagReport,
  selectFlagReportsFor,
} from './queries/flags.js';
export type { NewFlagReport } from './queries/flags.js';
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
  claimPseudonym,
  selectPseudonym,
  selectRegions,
  setChosenRegion,
} from './queries/profile.js';
export { deleteAccount, exportAccount, selectParticipantsOf } from './queries/account.js';
export type { AccountExport, Deletion } from './queries/account.js';
export type { Claim, Pseudonym } from './queries/profile.js';
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
export {
  recomputePlayerStats,
  recordRoundFinished,
  recordRoundsJoined,
  selectPlayerStats,
  selectPlayersActiveSince,
  selectPlayersWithStats,
} from './queries/stats.js';
export type { FinishedRound, PerfectRound, PlayerStats } from './queries/stats.js';
export {
  assignQuests,
  claimQuest,
  claimStatement,
  selectQuestById,
  selectQuestSet,
  selectRoundsInWindow,
} from './queries/quests.js';
export type {
  AssignedQuest,
  QuestClaim,
  QuestPeriodName,
  QuestToAssign,
  RoundInWindow,
} from './queries/quests.js';
export {
  boardQuery,
  countBoardPlayers,
  rebuildLeaderboard,
  recordEligibleScore,
  selectBoard,
  selectEligibleScores,
  selectOwnRank,
} from './queries/leaderboard.js';
export type {
  BoardQuery,
  BoardRow,
  EligibleScore,
  OwnRank,
} from './queries/leaderboard.js';
export {
  balanceQuery,
  movementsOf,
  recordMovement,
  selectBalance,
  selectMovementByKey,
  sumBalance,
} from './queries/coins.js';
export type {
  CoinMovementToRecord,
  CoinSource,
  MovementOutcome,
  RecordedMovement,
} from './queries/coins.js';
export { seed } from './seed/seed.js';
