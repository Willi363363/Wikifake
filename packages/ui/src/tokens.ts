// The theme's tokens, as data.
//
// The gallery renders this list rather than a hand-written swatch per colour:
// a gallery that has to be edited whenever a token is added is a gallery that
// stops being complete on the first token somebody forgets. `theme.test.ts`
// holds the list and `theme.css` to each other, so "the gallery shows every
// token" is true by construction rather than by inspection.
//
// The names are the CSS custom properties without their namespace: `bg` is
// `--color-bg`, and the Tailwind utility for it is `bg-bg`.

/** What a colour is for. Groups the gallery, and nothing else. */
export type TokenGroup = 'surface' | 'text' | 'fill' | 'wash';

export interface ColourToken {
  /** The name after `--color-`. */
  readonly name: string;
  readonly group: TokenGroup;
  /** One line on what it is for, shown beside the swatch. */
  readonly role: string;
}

export const COLOUR_TOKENS: readonly ColourToken[] = [
  { name: 'bg', group: 'surface', role: 'the page' },
  { name: 'bg-grain', group: 'surface', role: 'a deeper ground, behind the page' },
  { name: 'surface', group: 'surface', role: 'a card, a panel, the reading sheet' },
  { name: 'line', group: 'surface', role: 'an internal divider, inside a card' },
  { name: 'line-strong', group: 'surface', role: 'the structural 3px border' },

  { name: 'ink', group: 'text', role: 'what is being read' },
  { name: 'ink-2', group: 'text', role: 'secondary text, still read' },
  { name: 'muted', group: 'text', role: 'labels, captions, metadata' },
  { name: 'muted-2', group: 'text', role: 'the most withdrawn — large text only' },
  { name: 'on-fill', group: 'text', role: 'text on a fill — never inverts' },

  { name: 'accent', group: 'fill', role: 'the primary action' },
  { name: 'accent-line', group: 'fill', role: 'focus, selection, the player’s marks' },
  { name: 'bronze', group: 'fill', role: 'a hint, which is paid for' },
  { name: 'green', group: 'fill', role: 'found — a falsification caught' },
  { name: 'warn', group: 'fill', role: 'missed — a falsification let through' },
  { name: 'danger', group: 'fill', role: 'wrong — a paragraph marked for nothing' },

  { name: 'accent-soft', group: 'wash', role: 'a marked paragraph' },
  { name: 'bronze-soft', group: 'wash', role: 'a paragraph a hint was bought on' },
  { name: 'green-soft', group: 'wash', role: 'the FOUND row of the debrief' },
  { name: 'warn-soft', group: 'wash', role: 'the MISSED row' },
  { name: 'danger-soft', group: 'wash', role: 'the WRONGLY MARKED row' },
];

/**
 * The tokens that are the same colour in both palettes.
 *
 * A fill does not change when the theme does — a yellow button is that yellow
 * on a dark page — and `on-fill` is black on either ground because the colour
 * underneath it is. Everything else inverts, and `theme.test.ts` holds both
 * halves of that: these must match between the palettes, and nothing else may.
 */
export const THEME_INDEPENDENT: readonly string[] = [
  'on-fill',
  'accent',
  'accent-line',
  'bronze',
  'green',
  'warn',
  'danger',
];

/**
 * The elevations — a distance, not a blur.
 *
 * Each is a solid block of `--color-line-strong` at an offset: `sm` on a chip,
 * `md` on a button or a card, `lg` on a dialog. Nothing in this direction
 * floats, so nothing is blurred.
 */
export const SHADOW_TOKENS: readonly string[] = ['sm', 'md', 'lg'];

/**
 * The corners. `sm` to `xl` are all zero — the direction is square.
 *
 * `token` is the one exception it grants, at 4px, and it belongs to the
 * paragraph token and to nothing else. It is a token rather than a literal so
 * that the exception is findable: one grep says where the direction bends.
 */
export const RADIUS_TOKENS: readonly string[] = ['sm', 'md', 'lg', 'xl', 'token'];
