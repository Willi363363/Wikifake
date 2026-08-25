// WCAG contrast, computed rather than eyeballed.
//
// The phase asks for a contrast audit on the gallery's rendering. There is no
// browser in this repository's CI, but contrast does not need one: it is
// arithmetic on two colours, defined exactly by WCAG 2.1, and a number is a
// better artefact than a screenshot anyway — it says *how far* a pair is from
// passing, which is what decides whether a fix is a nudge or a redesign.
//
// The colours themselves are not here. This module takes a `read` function, so
// the same maths runs against the stylesheet in a test and against
// `getComputedStyle` in the gallery — one implementation, two sources of truth
// about what the colours actually are.

export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  /** 0 to 1. */
  readonly a: number;
}

/** `#rrggbb`, `#rgb`, `rgb(...)` or `rgba(...)`. Null for anything else. */
export function parseColour(value: string): Rgba | null {
  const text = value.trim();

  const long = /^#([0-9a-f]{6})$/i.exec(text);
  if (long !== null) {
    const hex = long[1] as string;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }

  const short = /^#([0-9a-f]{3})$/i.exec(text);
  if (short !== null) {
    const hex = short[1] as string;
    return {
      r: parseInt(`${hex[0] as string}${hex[0] as string}`, 16),
      g: parseInt(`${hex[1] as string}${hex[1] as string}`, 16),
      b: parseInt(`${hex[2] as string}${hex[2] as string}`, 16),
      a: 1,
    };
  }

  // `rgb(24 24 27 / 7%)` as well as `rgba(24, 24, 27, 0.07)`: a browser
  // normalises to whichever it prefers, and the gallery reads what the browser
  // says rather than what the stylesheet wrote.
  const functional = /^rgba?\(([^)]+)\)$/i.exec(text);
  if (functional === null) return null;

  const parts = (functional[1] as string)
    .split(/[,/\s]+/)
    .filter(Boolean)
    .map((part) => (part.endsWith('%') ? Number(part.slice(0, -1)) / 100 : Number(part)));
  const [r, g, b, a] = parts;
  if (r === undefined || g === undefined || b === undefined) return null;
  if ([r, g, b].some(Number.isNaN)) return null;

  return { r, g, b, a: a === undefined || Number.isNaN(a) ? 1 : a };
}

/**
 * A translucent colour, flattened onto what is behind it.
 *
 * Half the palette is `rgba(...)` — the glass surfaces, every hairline, three of
 * the accent borders — and a ratio computed against a colour with an alpha
 * channel is a ratio computed against a colour nobody sees.
 */
export function over(fg: Rgba, bg: Rgba): Rgba {
  if (fg.a >= 1) return fg;
  const mix = (front: number, back: number): number => fg.a * front + (1 - fg.a) * back;
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 };
}

/** WCAG 2.1 relative luminance. */
export function relativeLuminance(colour: Rgba): number {
  const channel = (value: number): number => {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b)
  );
}

/** WCAG 2.1 contrast ratio, between 1 and 21. Order does not matter. */
export function contrastRatio(one: Rgba, other: Rgba): number {
  const [brighter, darker] = [relativeLuminance(one), relativeLuminance(other)].sort(
    (a, b) => b - a,
  );
  return ((brighter as number) + 0.05) / ((darker as number) + 0.05);
}

/**
 * What a ratio is good for.
 *
 * `AA` is 4.5:1, which body text needs. `large` is 3:1, which WCAG allows for
 * text at 18.66px bold or 24px — and which is also the floor for anything that
 * carries meaning without being text at all, a border or an icon.
 */
export type ContrastGrade = 'AA' | 'large' | 'fail';

export function gradeOf(ratio: number): ContrastGrade {
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'large';
  return 'fail';
}

export interface ContrastPair {
  /** The `--color-` token drawn on top. */
  readonly fg: string;
  /** The `--color-` token underneath. */
  readonly bg: string;
  /** Where the pair actually occurs. Named so a failure is actionable. */
  readonly use: string;
  /** What it has to reach. `large` for text the palette declares large-only. */
  readonly needs: ContrastGrade;
}

/**
 * Every pair the design system actually renders.
 *
 * Written out rather than generated from the cross product: two hundred
 * combinations nobody uses would bury the fifteen that carry the game.
 */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { fg: 'ink', bg: 'bg', use: 'body text on the page', needs: 'AA' },
  { fg: 'ink', bg: 'surface', use: 'body text on a card', needs: 'AA' },
  { fg: 'ink', bg: 'bg-grain', use: 'body text on the deeper ground', needs: 'AA' },
  { fg: 'ink', bg: 'glass', use: 'body text on a glass panel', needs: 'AA' },
  { fg: 'ink-2', bg: 'bg', use: 'secondary text on the page', needs: 'AA' },
  { fg: 'ink-2', bg: 'surface', use: 'secondary text on a card', needs: 'AA' },
  { fg: 'muted', bg: 'bg', use: 'labels and captions on the page', needs: 'AA' },
  { fg: 'muted', bg: 'surface', use: 'labels and captions on a card', needs: 'AA' },
  { fg: 'muted', bg: 'glass', use: 'labels on a glass panel', needs: 'AA' },
  // The palette's own role line says "large text only", so that is what it is
  // held to. It still has to clear three.
  { fg: 'muted-2', bg: 'bg', use: 'the most withdrawn text, large only', needs: 'large' },
  {
    fg: 'muted-2',
    bg: 'surface',
    use: 'the most withdrawn text on a card, large only',
    needs: 'large',
  },
  { fg: 'accent', bg: 'bg', use: 'a link or a total on the page', needs: 'AA' },
  { fg: 'accent', bg: 'surface', use: 'a link or a total on a card', needs: 'AA' },
  {
    fg: 'accent',
    bg: 'accent-soft',
    use: 'a marked paragraph, and the accent badge',
    needs: 'AA',
  },
  { fg: 'surface', bg: 'accent', use: 'the primary button', needs: 'AA' },
  { fg: 'bronze', bg: 'bg', use: "a hint's price on the page", needs: 'AA' },
  {
    fg: 'bronze',
    bg: 'bronze-soft',
    use: 'a paragraph a hint was bought on, and the bronze badge',
    needs: 'AA',
  },
  {
    fg: 'green',
    bg: 'green-soft',
    use: 'the FOUND verdict, in the debrief',
    needs: 'AA',
  },
  {
    fg: 'warn',
    bg: 'warn-soft',
    use: 'the MISSED verdict, in the debrief',
    needs: 'AA',
  },
  {
    fg: 'danger',
    bg: 'danger-soft',
    use: 'the WRONGLY MARKED verdict, and the danger button',
    needs: 'AA',
  },
];

export interface ContrastResult extends ContrastPair {
  readonly ratio: number;
  readonly grade: ContrastGrade;
  readonly passes: boolean;
}

/** Reads a token's declared value: `read('ink')` gives what `--color-ink` is. */
export type ReadColour = (token: string) => string;

/**
 * Every pair, measured.
 *
 * The page's own background is what a translucent surface is flattened onto, and
 * a translucent foreground is flattened onto the surface it sits on — which is
 * the order a browser paints them in.
 */
export function auditContrast(read: ReadColour): readonly ContrastResult[] {
  const page = parseColour(read('bg')) ?? { r: 255, g: 255, b: 255, a: 1 };

  return CONTRAST_PAIRS.map((pair) => {
    const rawBg = parseColour(read(pair.bg));
    const rawFg = parseColour(read(pair.fg));
    if (rawBg === null || rawFg === null) {
      return { ...pair, ratio: 0, grade: 'fail' as const, passes: false };
    }

    const bg = over(rawBg, page);
    const ratio = contrastRatio(over(rawFg, bg), bg);
    const grade = gradeOf(ratio);

    return {
      ...pair,
      ratio,
      grade,
      passes: pair.needs === 'AA' ? grade === 'AA' : grade !== 'fail',
    };
  });
}
