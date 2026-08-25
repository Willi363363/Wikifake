// The design system, as the applications see it.
//
// The stylesheet is not exported from here: CSS is imported by path
// (`@wikifake/ui/theme.css`) so a bundler can see it, and a module that imported
// it would make every consumer of a single type pull the whole theme in.
export { COLOUR_TOKENS, RADIUS_TOKENS, SHADOW_TOKENS } from './tokens.js';
export type { ColourToken, TokenGroup } from './tokens.js';

export { MOTIONS, REDUCIBLE } from './motion.js';
export type { Motion, MotionKind } from './motion.js';

export { cn } from './cn.js';

export { Button, buttonVariants } from './primitives/button.js';
export type { ButtonProps } from './primitives/button.js';
export { Badge, badgeVariants } from './primitives/badge.js';
export type { BadgeProps } from './primitives/badge.js';
export { Input } from './primitives/input.js';
export type { InputProps } from './primitives/input.js';
export { Label } from './primitives/label.js';
export type { LabelProps } from './primitives/label.js';
export { Progress } from './primitives/progress.js';
export type { ProgressProps } from './primitives/progress.js';
export { Separator } from './primitives/separator.js';
export type { SeparatorProps } from './primitives/separator.js';
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './primitives/dialog.js';
export type { DialogContentProps } from './primitives/dialog.js';

export { ParagraphToken, tokenVariants } from './token/paragraph-token.js';
export type { ParagraphTokenProps } from './token/paragraph-token.js';
export {
  isInteractive,
  tokenStateFor,
  TOKEN_LABELS,
  TOKEN_STATES,
  VERDICT_STATES,
} from './token/state.js';
export type { TokenFacts, TokenState } from './token/state.js';

/** Every component, by name. The gallery renders this, and a test holds it. */
export const PRIMITIVES: readonly string[] = [
  'Badge',
  'Button',
  'Dialog',
  'Input',
  'Label',
  'ParagraphToken',
  'Progress',
  'Separator',
];
