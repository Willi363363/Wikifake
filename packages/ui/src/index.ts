// The design system, as the applications see it.
//
// The stylesheet is not exported from here: CSS is imported by path
// (`@wikifake/ui/theme.css`) so a bundler can see it, and a module that imported
// it would make every consumer of a single type pull the whole theme in.
export { COLOUR_TOKENS, RADIUS_TOKENS, SHADOW_TOKENS } from './tokens.js';
export type { ColourToken, TokenGroup } from './tokens.js';
