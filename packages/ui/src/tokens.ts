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
  {
    name: 'line-strong',
    group: 'surface',
    role: 'a firmer edge — a field, a table rule',
  },

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
 * The tokens that are the same colour in both palettes. There are none.
 *
 * Track A had a list here, and the reason was sound for the palette it had: a
 * yellow button is that yellow on a dark page, so the fills and the black on
 * them did not move. J2's accent is a blue, and #2557e6 on a #141b26 card
 * measures 2.95 — a fill that stayed put would be a fill half the site could
 * not read. So L.3 emptied the list rather than argue with it.
 *
 * It stays exported, and empty is the assertion: `theme.test.ts` reads it to
 * mean *every colour must differ between the palettes*, and a token somebody
 * forgets to translate fails there.
 */
export const THEME_INDEPENDENT: readonly string[] = [];

/**
 * The elevations — light, and used sparingly.
 *
 * Track A's were a solid block of `--color-line-strong` at an offset, because
 * that direction drew a raised object as the same object shifted. J2 separates
 * a tile by making it a different surface, so most of the interface asks for no
 * elevation at all. What is left for a shadow to say is *I am over the page* —
 * true of a dialog and of a menu, false of a card.
 *
 * Each is restated in `.dark`: a shadow is light, and a near-black haze that
 * separates a white card from a grey page is invisible on #0b0f17.
 */
export const SHADOW_TOKENS: readonly string[] = ['sm', 'md', 'lg'];

/**
 * The corners — a scale with a job per step, since L.6.
 *
 * They were all zero while the direction was square. `sm` is a chip, `md` a
 * control, `lg` a panel, `xl` a tile or a dialog, and a screen picks the role
 * rather than the number.
 *
 * `token` stays separate at 4px. It is no longer an exception — the direction
 * rounds everything now — but it is still a corner that belongs to the
 * paragraph mark rather than to this scale, so rounding the tiles further must
 * not round the marks inside the prose.
 */
export const RADIUS_TOKENS: readonly string[] = ['sm', 'md', 'lg', 'xl', 'token'];
