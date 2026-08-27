// The animations, as data — which is what "typed" buys.
//
// In the current game a keyframe is a string in an inline style. Nothing checks
// the name exists, nothing can enumerate them, and nothing can decide that one
// of them is dangerous. Here each is an entry, each entry says whether the
// preference switches it off, and `motion.test.ts` holds the list and the
// stylesheet to each other in both directions.
//
// The names are the CSS animation names: `shake` is `--animate-shake`, and the
// Tailwind utility is `animate-shake`.

/** What the animation does, which is what decides whether it may keep doing it. */
export type MotionKind =
  /** Opacity only. Not motion, and kept under `prefers-reduced-motion`. */
  | 'fade'
  /** A small settle — a few pixels, once. Kept. */
  | 'settle'
  /** Rapid opacity swings. A photosensitivity hazard. */
  | 'flash'
  /** The page or the article displaced. A vestibular hazard. */
  | 'displace';

export interface Motion {
  readonly name: string;
  readonly kind: MotionKind;
  /** What it is for, in one line. Shown in the gallery. */
  readonly role: string;
  /**
   * Whether `prefers-reduced-motion: reduce` switches it off entirely.
   *
   * True for everything that flashes or displaces. A fade is left alone: it is
   * not motion, and removing every one makes state changes snap rather than
   * settle, which helps nobody.
   */
  readonly reducible: boolean;
}

export const MOTIONS: readonly Motion[] = [
  { name: 'fade-in', kind: 'fade', role: 'a panel appearing', reducible: false },
  {
    name: 'stagger-in',
    kind: 'settle',
    role: 'a list arriving, one line after another',
    reducible: false,
  },
  {
    name: 'slide-in-right',
    kind: 'settle',
    role: 'an item notification',
    reducible: false,
  },
  { name: 'slide-up-fade', kind: 'settle', role: 'a toast', reducible: false },
  {
    name: 'token-flash',
    kind: 'fade',
    role: 'a paragraph just marked',
    reducible: false,
  },
  {
    name: 'pulse-dot',
    kind: 'fade',
    role: 'a player is connected',
    reducible: false,
  },
  {
    name: 'scan-sweep',
    kind: 'settle',
    role: 'the SCANNER reading the article',
    reducible: false,
  },
  { name: 'frost-pulse', kind: 'fade', role: 'frost on the glass', reducible: false },
  {
    name: 'damage-pop',
    kind: 'settle',
    role: 'what an item just cost you, in figures',
    reducible: false,
  },

  {
    name: 'shake',
    kind: 'displace',
    role: 'EARTHQUAKE — about seven displacements a second',
    reducible: true,
  },
  {
    name: 'article-spin',
    kind: 'displace',
    role: 'SPIN — the whole article turning',
    reducible: true,
  },
  {
    name: 'static-glitch',
    kind: 'displace',
    role: 'TV static — ten displacements a second',
    reducible: true,
  },
  {
    name: 'lightning-zap',
    kind: 'flash',
    role: 'the bolt — about 4.4 flashes a second',
    reducible: true,
  },
  {
    name: 'screen-flash',
    kind: 'flash',
    role: 'the sky lighting up — about 4.4 flashes a second',
    reducible: true,
  },
  {
    name: 'snowfall',
    kind: 'displace',
    role: 'BLIZZARD — the whole viewport falling',
    reducible: true,
  },
  {
    name: 'fog-drift',
    kind: 'displace',
    role: 'fog crossing the article',
    reducible: true,
  },
];

/** The ones a preference switches off. Three flashes and four displacements. */
export const REDUCIBLE: readonly string[] = MOTIONS.filter(
  (motion) => motion.reducible,
).map((motion) => motion.name);
