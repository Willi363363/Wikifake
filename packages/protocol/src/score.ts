// The score breakdown, in one shape.
//
// There are two today, and they disagree: the solo submission returns
// `{tp, fp, hintsUsed, hintPenalty, scoreStolen, timeBonus}` while a multiplayer
// leaderboard row returns the same thing **without** `scoreStolen`. A client
// rendering a debrief therefore has to know which mode it is in to know whether
// a field exists. One shape, used by both.
//
// `scoreStolen` is simply 0 in solo: nobody is there to steal from you. An
// always-zero field costs nothing and removes a branch from every consumer.
//
// The numbers themselves — what a true positive is worth, what a hint costs —
// are the scoring rules of step 1.4. This is the shape they report in.
import { z } from 'zod';

export const scoreBreakdown = z.object({
  truePositives: z.number().int().min(0),
  falsePositives: z.number().int().min(0),
  hintsUsed: z.number().int().min(0),
  hintPenalty: z.number().int().min(0),
  scoreStolen: z.number().int().min(0),
  timeBonus: z.number().int().min(0),
});
export type ScoreBreakdown = z.infer<typeof scoreBreakdown>;
