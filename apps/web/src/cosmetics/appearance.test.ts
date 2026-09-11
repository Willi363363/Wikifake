// The catalogue and the appearances, held to each other — step H.6.
//
// **This test lives here and not in either package, and that is the graph's
// doing.** `@wikifake/domain` holds the catalogue and knows nothing about how a
// cosmetic is drawn; `@wikifake/ui` holds the appearances and depends on no
// `@wikifake` package at all, because the design system is the one thing an
// application can use without pulling the game in.
//
// So neither can check the other, and `apps/web` is the first place both are in
// scope. It is also the place that would break: a cosmetic in the shop with no
// appearance is a purchase that changes nothing on screen, and one drawn but not
// sold is dead code nobody can reach.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { COSMETIC_IDS, cosmeticsInSlot } from '@wikifake/domain';
import { FRAMES, MARKER_COLOURS, MARK_STYLES } from '@wikifake/ui';
import { describe, expect, it } from 'vitest';

describe('H.6 — everything sold can be drawn, and everything drawn is sold', () => {
  it.each([
    ['marker', MARKER_COLOURS],
    ['markStyle', MARK_STYLES],
    ['frame', FRAMES],
  ] as const)('draws exactly the %s slot', (slot, appearances) => {
    expect(Object.keys(appearances).sort()).toEqual(
      cosmeticsInSlot(slot)
        .map((cosmetic) => cosmetic.id)
        .sort(),
    );
  });

  it('draws every identifier in the catalogue, from one map each', () => {
    // The sweep the three above would miss between them if a fourth slot
    // arrived: nothing may be sold without an appearance.
    for (const id of COSMETIC_IDS) {
      const maps = [MARKER_COLOURS, MARK_STYLES, FRAMES].filter((map) =>
        Object.hasOwn(map, id),
      );
      expect(maps, `${id} is drawn by ${String(maps.length)} maps`).toHaveLength(1);
    }
  });

  it('sells every identifier that can be drawn', () => {
    const drawn = [MARKER_COLOURS, MARK_STYLES, FRAMES].flatMap((map) =>
      Object.keys(map),
    );

    expect(drawn.sort()).toEqual([...COSMETIC_IDS].sort());
  });
});

describe('H.6 — a room does not wear a marker', () => {
  /*
   * The decision, guarded by construction rather than by a setting.
   *
   * `assignColour` hands out a distinct `PLAYER_COLOURS` entry per arrival so
   * that two players in a room can be told apart, and a bought colour cannot be
   * allowed to break that. So the rule is *which caller passes the outfit*:
   * `solo.tsx` does, `lobby/room.tsx` does not.
   *
   * Read as text, the way `purity.test.ts` and `cosmetics.test.ts` do, because
   * this is a claim about what a file does not do — and nothing goes red at the
   * moment somebody adds it.
   */
  const read = (relative: string): string =>
    readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

  it('never hands the round a marker from the room screen', () => {
    const source = read('../lobby/room.tsx');

    expect(source).not.toContain('useOutfit');
    expect(source).not.toMatch(/\bmarker=/);
    expect(source).not.toMatch(/\bmarkStyle=/);
  });

  it('is reading the file that renders the room, not an empty string', () => {
    // The guard above passes trivially if the path is wrong. This is what says
    // the file was found and is the one that mounts `Round`.
    expect(read('../lobby/room.tsx')).toContain('<Round');
  });

  it('does hand it one from the solo screen, which is the other half', () => {
    expect(read('../solo/solo.tsx')).toContain('marker={worn.marker}');
  });
});
