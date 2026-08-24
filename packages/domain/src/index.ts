// The game rules, pure: scoring, grading, item catalogue and effects, and the
// room state machine as a reducer.
//
// The rules themselves arrive with steps 1.4 to 1.9 of
// plans/rewrite/phase-01-core.md. What is here is the shape they all take.
export { emit, settle } from './reducer.js';
export type { Reduced, Reducer } from './reducer.js';
