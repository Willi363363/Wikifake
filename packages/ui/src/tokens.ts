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
export type TokenGroup = 'surface' | 'text' | 'accent';

export interface ColourToken {
  /** The name after `--color-`. */
  readonly name: string;
  readonly group: TokenGroup;
  /** One line on what it is for, shown beside the swatch. */
  readonly role: string;
}

export const COLOUR_TOKENS: readonly ColourToken[] = [
  { name: 'bg', group: 'surface', role: 'the page — warm paper' },
  { name: 'bg-grain', group: 'surface', role: 'a deeper warm, behind the page' },
  { name: 'surface', group: 'surface', role: 'a card, a panel, a sheet' },
  { name: 'glass', group: 'surface', role: 'a surface you can see through' },
  { name: 'glass-strong', group: 'surface', role: 'the same, less transparent' },
  { name: 'line', group: 'surface', role: 'a border that separates' },
  { name: 'line-strong', group: 'surface', role: 'a border that delimits' },

  { name: 'ink', group: 'text', role: 'what is being read' },
  { name: 'ink-2', group: 'text', role: 'secondary text, still read' },
  { name: 'muted', group: 'text', role: 'labels, captions, metadata' },
  { name: 'muted-2', group: 'text', role: 'the most withdrawn — large text only' },

  { name: 'accent', group: 'accent', role: 'verification — the game itself' },
  { name: 'accent-soft', group: 'accent', role: 'a wash of the same' },
  { name: 'accent-line', group: 'accent', role: 'its border' },
  { name: 'bronze', group: 'accent', role: 'a hint, which is paid for' },
  { name: 'bronze-soft', group: 'accent', role: 'a wash of the same' },
  { name: 'green', group: 'accent', role: 'found — a falsification caught' },
  { name: 'green-soft', group: 'accent', role: 'a wash of the same' },
  { name: 'warn', group: 'accent', role: 'missed — a falsification let through' },
  { name: 'warn-soft', group: 'accent', role: 'a wash of the same' },
  { name: 'danger', group: 'accent', role: 'wrong — a paragraph marked for nothing' },
  { name: 'danger-soft', group: 'accent', role: 'a wash of the same' },
];

/** The elevations, from a hairline to a dialog. */
export const SHADOW_TOKENS: readonly string[] = ['sm', 'md', 'lg'];

/** The corners. `sm` on a chip, `xl` on a sheet. */
export const RADIUS_TOKENS: readonly string[] = ['sm', 'md', 'lg', 'xl'];
