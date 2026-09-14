// A candidate's two palettes — step L.1, round two.
//
// The owner asked for a light mode and a dark mode, so a direction is no longer
// one set of colours: it is a pair, and a candidate that only works in one of
// them has not answered the question.
//
// **Both are written at once, deliberately.** Phase 6 built a light palette by
// darkening a dark one afterwards and shipped seven unreadable pairs; track A
// measured forty pairs before any CSS moved and shipped none. L.2 measures
// whichever of these wins — these are drafts, and the `ink`/`onAccent` fields
// are where that measurement will land.

export interface Tone {
  /** The page. */
  readonly bg: string;
  /** A panel lifted off it. */
  readonly surface: string;
  /** Hairlines and edges. */
  readonly line: string;
  /** Body text. */
  readonly ink: string;
  /** Secondary text — never used for anything that must be read closely. */
  readonly muted: string;
  /** The one vivid colour. Actions, and nothing else. */
  readonly accent: string;
  /** What sits on the accent. */
  readonly onAccent: string;
  /** A second vivid colour, used once per screen at most. */
  readonly second: string;
  /**
   * The face, as a CSS stack.
   *
   * A stack and not a loaded file: a bench that pulls three web fonts is a
   * bench measuring the network. Every family named here is on the machine
   * already, and L.3 chooses the real one once a direction is settled.
   */
  readonly font: string;
}

export type Theme = 'light' | 'dark';

export interface Palette {
  readonly light: Tone;
  readonly dark: Tone;
}
