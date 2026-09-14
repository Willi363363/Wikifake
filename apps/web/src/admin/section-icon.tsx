// The rail's glyphs — step K.1.
//
// `currentColor` throughout, and not only to save a prop: `fills.test.ts`
// refuses a colour written into an SVG attribute, because a glyph that names
// its own colour is a glyph that stays that colour when the palette inverts.
import type { SectionIcon } from './sections.js';

const PATHS: Readonly<Record<SectionIcon, readonly string[]>> = {
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'],
  pulse: ['M3 12h4l2.5-6 4 13 2.5-7h5'],
  users: [
    'M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
    'M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6',
    'M16 5.5a3.5 3.5 0 0 1 0 7',
    'M18 14.5c2 .9 3 2.9 3 5.5',
  ],
  funnel: ['M3 4h18l-7 8v7l-4 2v-9z'],
  cards: ['M2.5 7h19v11h-19z', 'M7 12.5h3', 'M8.5 11v3', 'M15 11.5h.01', 'M17.5 14h.01'],
  bars: ['M3 19h18', 'M6 19V9', 'M11 19V4', 'M16 19v-7', 'M21 19v-4'],
  coin: [
    'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z',
    'M15 9.5C14.2 8.5 13.2 8 12 8c-2 0-3 1-3 2.2 0 2.8 6 1.4 6 3.9C15 15.2 13.8 16 12 16c-1.3 0-2.4-.5-3-1.5',
  ],
  document: ['M5 3h11l3 3v15H5z', 'M8.5 10h7', 'M8.5 14h7', 'M8.5 17.5h4'],
};

export interface SectionGlyphProps {
  readonly name: SectionIcon;
  readonly size?: number;
}

export function SectionGlyph({ name, size = 18 }: SectionGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="square"
      className="shrink-0"
      aria-hidden
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
