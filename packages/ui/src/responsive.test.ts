// Two rules, and the reason they are rules rather than a habit.
//
// The criterion for this step is "the gallery displays without horizontal
// overflow or overlap at 360 px as at 1280 px", and there is no browser in this
// repository's CI to measure that in. What there *is* is the pair of mistakes
// that cause it, both of which are visible in the source:
//
//   R1 — a length larger than the floor with no breakpoint in front of it. A
//        fixed 380px panel does not look cramped at 360; it produces a page that
//        scrolls sideways, and it scrolls on every screen of the site at once.
//   R2 — a multi-column layout that is unconditional. Two columns at 360 CSS
//        pixels is two columns of about 170, which is where text starts
//        overlapping its neighbour.
//
// Neither is a proxy for a screenshot. Both are the actual defect, and a
// regression in either is caught here rather than on somebody's phone.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** 360 CSS pixels: a phone held upright, and `--width-floor` in the theme. */
const FLOOR_PX = 360;

// Derived from the file's own path rather than `new URL('.', import.meta.url)`:
// under jsdom the global `URL` resolves a bare `.` against the document's base
// — `http://localhost:3000` — instead of against the module, and the failure is
// "the URL must be of scheme file" a long way from the cause.
const HERE = dirname(fileURLToPath(import.meta.url));
const GALLERY = join(HERE, '..', '..', '..', 'apps', 'web', 'app', 'gallery');

function sourcesIn(directory: string): { path: string; text: string }[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourcesIn(path);
    if (!/\.tsx?$/.test(name) || name.includes('.test.')) return [];
    return [{ path: name, text: readFileSync(path, 'utf8') }];
  });
}

/** The design system, and the gallery that is this phase's deliverable. */
const SOURCES = [...sourcesIn(HERE), ...sourcesIn(GALLERY)];

/** Tailwind's four, plus the two the arbitrary-value syntax can carry. */
const BREAKPOINT = /(?:^|[\s'"`:])(?:sm|md|lg|xl|2xl|min-\[[^\]]+\]):/;

/**
 * Every class name in a file, one per entry.
 *
 * Crude on purpose: it splits on whitespace and quote characters, so it sees a
 * few words that are not classes. That costs nothing — a rule broken by a
 * non-class is a rule that reads oddly, not one that fails.
 */
function classesIn(text: string): string[] {
  return text.split(/[\s'"`(){}<>,]+/).filter(Boolean);
}

describe('6.5 — nothing that overflows a phone', () => {
  it('has sources to check', () => {
    expect(SOURCES.length).toBeGreaterThan(5);
  });

  // R1. Arbitrary lengths in pixels or rems, in any width or inset utility.
  describe.each(SOURCES)('$path', ({ text }) => {
    const lines = text.split('\n');

    it(`declares no fixed length above ${String(FLOOR_PX)}px`, () => {
      const offenders: string[] = [];

      for (const line of lines) {
        for (const found of line.matchAll(
          /\b(w|min-w|max-w|h|min-h|basis)-\[(\d+(?:\.\d+)?)(px|rem)\]/g,
        )) {
          const size = Number(found[2]) * (found[3] === 'rem' ? 16 : 1);
          // `max-w` is a ceiling: it never forces a page wider than itself.
          if (found[1] === 'max-w') continue;
          if (size > FLOOR_PX && !BREAKPOINT.test(line)) {
            offenders.push(`${found[0]} (${String(size)}px)`);
          }
        }
      }

      expect(offenders).toEqual([]);
    });

    // R2. A grid of more than one column, or a row, without a breakpoint.
    it('puts every multi-column layout behind a breakpoint', () => {
      const offenders = classesIn(text)
        .filter((name) => /^(grid-cols-([2-9]|1[0-2])|flex-row)$/.test(name))
        .filter((name) => !BREAKPOINT.test(`:${name}`));

      expect(offenders).toEqual([]);
    });
  });

  // The floor itself, so the number in the theme and the number here cannot
  // drift apart.
  it('agrees with the theme about where the floor is', () => {
    const theme = readFileSync(join(HERE, 'theme.css'), 'utf8');
    expect(theme).toContain(`--width-floor: ${String(FLOOR_PX)}px`);
  });
});
