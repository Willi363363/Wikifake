// A database somebody can develop against.
//
// Fixed identifiers, no clock, no randomness: replaying the seed has to produce
// the same database, or "idempotent" is a claim rather than a property. The
// timestamps are literals for the same reason — a seed whose rows move every run
// makes an ordering bug look like a flake.
//
// **Every** row carries an explicit id, including the tables whose primary key
// defaults to a random UUID. Leaving those to the default made the seed look
// idempotent — it printed "seeded" twice without error — while quietly doubling
// `item_use`, `llm_call` and `flag_report` on the second run, because
// `onConflictDoNothing` had no conflict to find.
//
// Not test data. Tests build exactly the rows they assert on; this exists so
// phases 3 to 8 can be developed without clicking through a game first.
import type { ItemId } from '@wikifake/protocol';

const AT = (minutes: number): Date => new Date(Date.UTC(2026, 0, 15, 12, minutes, 0));

export const SEED_USERS = [
  { id: 'seed_user_ada', name: 'Ada Lovelace', email: 'ada@example.org' },
  { id: 'seed_user_bob', name: 'Bob Bricoleur', email: 'bob@example.org' },
] as const;

export const SEED_PROFILES = [
  { userId: 'seed_user_ada', displayName: 'ada', accent: 'teal' },
  { userId: 'seed_user_bob', displayName: 'bob', accent: 'bronze' },
] as const;

export const SEED_ROOM = {
  code: 'SEED01',
  hostName: 'ada',
  phase: 'lobby' as const,
  withItems: true,
  timeLimit: 300,
};

/**
 * A finished game. French content, because the game reads `fr.wikipedia.org` —
 * the one exception the repository's language rule makes, and a seed with
 * English paragraphs would not look like anything the falsifier produces.
 */
export const SEED_GAME = {
  id: '00000000-0000-4000-8000-000000000001',
  roomCode: SEED_ROOM.code,
  mode: 'multiplayer' as const,
  topic: 'Paris',
  sourceUrl: 'https://fr.wikipedia.org/wiki/Paris',
  paragraphs: [
    'Paris est la capitale de la France et sa plus grande ville.',
    'La ville est divisée en deux arrondissements administratifs.',
    'La Seine traverse Paris d’est en ouest.',
    'La tour Eiffel a été achevée en 1912 pour une exposition universelle.',
  ],
  totalFakes: 2,
  timeLimit: 300,
  fromCache: false,
  startedAt: AT(0),
  endedAt: AT(4),
};

/** C3.3 — ascending paragraph index, numbers sequential from 1. */
export const SEED_POSITIONS = [
  {
    gameId: SEED_GAME.id,
    paragraphIndex: 2,
    falseInfoNumber: 1,
    falseStatement: 'La ville est divisée en deux arrondissements administratifs.',
    originalText: 'La ville est divisée en vingt arrondissements administratifs.',
    explanation: 'Paris compte vingt arrondissements, pas deux.',
    hint: 'Vérifiez le nombre d’arrondissements.',
  },
  {
    gameId: SEED_GAME.id,
    paragraphIndex: 4,
    falseInfoNumber: 2,
    falseStatement:
      'La tour Eiffel a été achevée en 1912 pour une exposition universelle.',
    originalText: 'La tour Eiffel a été achevée en 1889 pour une exposition universelle.',
    explanation: 'La tour Eiffel a été achevée en 1889.',
    hint: 'Vérifiez l’année.',
  },
] as const;

export const SEED_PARTICIPANTS = [
  {
    id: '00000000-0000-4000-8000-000000000010',
    gameId: SEED_GAME.id,
    userId: 'seed_user_ada',
    guestName: null,
    colour: '#e63946',
    submittedAt: AT(3),
    // C2.1 — found both, marked one clean paragraph, bought one reveal, was
    // robbed of 50: 2×150 − 80 − 200 − 50 + 90 = 60.
    score: 60,
    truePositives: 2,
    falsePositives: 1,
    hintsUsed: 1,
    hintPenalty: 200,
    scoreStolen: 50,
    timeBonus: 90,
  },
  {
    id: '00000000-0000-4000-8000-000000000011',
    gameId: SEED_GAME.id,
    userId: null,
    guestName: 'chloé',
    colour: '#2a9d8f',
    submittedAt: AT(4),
    // Found one, marked nothing wrong, bought no hint: 150 + 60 = 210.
    score: 210,
    truePositives: 1,
    falsePositives: 0,
    hintsUsed: 0,
    hintPenalty: 0,
    scoreStolen: 0,
    timeBonus: 60,
  },
] as const;

export const SEED_ANSWERS = [
  { participantId: SEED_PARTICIPANTS[0].id, paragraphIndex: 2 },
  { participantId: SEED_PARTICIPANTS[0].id, paragraphIndex: 4 },
  { participantId: SEED_PARTICIPANTS[0].id, paragraphIndex: 1 },
  { participantId: SEED_PARTICIPANTS[1].id, paragraphIndex: 4 },
] as const;

/** C2.2 — a nudge then a reveal on the same falsification: 200 in total, not 250. */
export const SEED_HINT_PURCHASES = [
  {
    participantId: SEED_PARTICIPANTS[0].id,
    falseInfoNumber: 1,
    level: 1,
    charged: 50,
    purchasedAt: AT(1),
  },
  {
    participantId: SEED_PARTICIPANTS[0].id,
    falseInfoNumber: 1,
    level: 2,
    charged: 150,
    purchasedAt: AT(2),
  },
] as const;

export const SEED_ITEM_USES = [
  {
    id: '00000000-0000-4000-8000-000000000020',
    gameId: SEED_GAME.id,
    casterId: SEED_PARTICIPANTS[1].id,
    targetId: SEED_PARTICIPANTS[0].id,
    itemId: 'SCORE_STEAL' as ItemId,
    usedAt: AT(2),
  },
  {
    id: '00000000-0000-4000-8000-000000000021',
    gameId: SEED_GAME.id,
    casterId: SEED_PARTICIPANTS[0].id,
    targetId: null,
    itemId: 'SCANNER' as ItemId,
    usedAt: AT(3),
  },
] as const;

export const SEED_LLM_CALLS = [
  {
    id: '00000000-0000-4000-8000-000000000030',
    gameId: SEED_GAME.id,
    model: 'gemini-3.1-flash-lite',
    kind: 'topic_choice' as const,
    inputTokens: 480,
    outputTokens: 30,
    promptChars: 1_900,
    outputChars: 120,
    failed: false,
    createdAt: AT(0),
  },
  {
    id: '00000000-0000-4000-8000-000000000031',
    gameId: SEED_GAME.id,
    model: 'gemini-3.1-flash-lite',
    kind: 'falsification' as const,
    inputTokens: 5_200,
    outputTokens: 940,
    promptChars: 20_800,
    outputChars: 3_700,
    failed: false,
    createdAt: AT(0),
  },
  // C4.5 — a failure, so the seed exercises the branch that must not be counted
  // as a generated game.
  {
    id: '00000000-0000-4000-8000-000000000032',
    gameId: null,
    model: 'gemini-3.1-flash-lite',
    kind: 'falsification' as const,
    inputTokens: 4_800,
    outputTokens: 0,
    promptChars: 19_200,
    outputChars: 0,
    failed: true,
    createdAt: AT(0),
  },
] as const;

export const SEED_FLAG_REPORT = {
  id: '00000000-0000-4000-8000-000000000040',
  gameId: SEED_GAME.id,
  reporterId: 'seed_user_ada',
  articleTitle: 'Paris',
  articleUrl: 'https://fr.wikipedia.org/wiki/Paris',
  flaggedClaim: 'La Seine traverse Paris d’est en ouest.',
  proposedCorrection: 'La Seine traverse Paris du sud-est vers le sud-ouest.',
  quickNote: '',
  explanation: 'Le tracé décrit une courbe, pas une ligne est-ouest.',
  sources: ['https://fr.wikipedia.org/wiki/Seine'],
  status: 'pending_human_review' as const,
  verdict: 'uncertain' as const,
  confidence: 55,
  reasoning: 'Le contexte ne tranche pas la formulation proposée.',
  sourcesFound: ['La Seine est un fleuve long de 777 kilomètres'],
  recommendation: 'needs_more_info' as const,
  createdAt: AT(5),
};
