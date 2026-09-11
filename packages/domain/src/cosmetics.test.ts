// The cosmetics catalogue — step H.5.
//
// The interesting test here is the last one. The others hold the catalogue to
// itself and to the earning rules; that one holds the whole package to track H's
// rule that **nothing bought with coins may change a round's outcome**, by
// reading the source of every module that decides one.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  CHEAPEST_COSMETIC_COINS,
  COSMETIC_CATALOGUE,
  COSMETIC_IDS,
  COSMETIC_SLOTS,
  canWear,
  cosmeticById,
  cosmeticsInSlot,
  isCosmeticId,
  outfitFrom,
  takeOff,
  wear,
  EMPTY_OUTFIT,
} from './cosmetics.js';
import { COINS_PER_PERFECT_ROUND, COINS_PER_ROUND } from './coins.js';
import { QUEST_CATALOGUE, QUEST_RULE_IDS } from './quests.js';

describe('H.5 — the catalogue defines every identifier it declares', () => {
  it('has one definition per identifier, and nothing else', () => {
    expect(Object.keys(COSMETIC_CATALOGUE).sort()).toEqual([...COSMETIC_IDS].sort());
  });

  it('agrees with the key it is filed under', () => {
    for (const id of COSMETIC_IDS) {
      expect(COSMETIC_CATALOGUE[id].id).toBe(id);
    }
  });

  it('puts every cosmetic in a declared slot, and fills every slot', () => {
    const used = new Set(COSMETIC_IDS.map((id) => COSMETIC_CATALOGUE[id].slot));
    expect([...used].sort()).toEqual([...COSMETIC_SLOTS].sort());
  });

  it('names the slot in the identifier, so a stored value reads without a join', () => {
    // `MARK_STYLE_` before `MARKER_` would match the wrong prefix, hence the
    // longer one first — the same trap a screen keying its copy would hit.
    const prefixes: Readonly<Record<string, string>> = {
      MARK_STYLE_: 'markStyle',
      MARKER_: 'marker',
      FRAME_: 'frame',
    };

    for (const id of COSMETIC_IDS) {
      const prefix = Object.keys(prefixes).find((candidate) => id.startsWith(candidate));
      expect(prefix, `${id} carries no slot prefix`).toBeDefined();
      expect(COSMETIC_CATALOGUE[id].slot).toBe(prefixes[prefix as string]);
    }
  });
});

describe('H.5 — a price is a price', () => {
  it('charges something for everything: there is no free entry', () => {
    for (const id of COSMETIC_IDS) {
      expect(COSMETIC_CATALOGUE[id].price).toBeGreaterThan(0);
      expect(Number.isInteger(COSMETIC_CATALOGUE[id].price)).toBe(true);
    }
  });

  it('costs more than a round pays, so the shop is not a grind', () => {
    // The calibration `CHEAPEST_COSMETIC_COINS` claims, held to the rules that
    // actually pay rather than to the comment that describes them. A cosmetic a
    // player can buy in a couple of rounds is a cosmetic they buy while learning
    // the game, and the shop stops being anything to come back for.
    const best = COINS_PER_ROUND + COINS_PER_PERFECT_ROUND;
    const cheapest = Math.min(...COSMETIC_IDS.map((id) => COSMETIC_CATALOGUE[id].price));

    expect(cheapest).toBe(CHEAPEST_COSMETIC_COINS);
    expect(cheapest).toBeGreaterThan(best);
    // A week of the retention loop, not an afternoon: more than the richest
    // single quest in the catalogue pays.
    const richestQuest = Math.max(
      ...QUEST_RULE_IDS.map((id) => QUEST_CATALOGUE[id].reward),
    );
    expect(cheapest).toBeGreaterThanOrEqual(richestQuest);
  });

  it('prices a slot rather than an item within it', () => {
    // A marker that costs three times another marker says one of them is
    // better, and none of them is. What may differ is the slot.
    for (const slot of COSMETIC_SLOTS) {
      const prices = new Set(cosmeticsInSlot(slot).map((cosmetic) => cosmetic.price));
      expect(prices.size, `${slot} prices its items unequally`).toBe(1);
    }
  });
});

describe('H.5 — reading an identifier back', () => {
  it('knows the ones it defines and refuses the rest', () => {
    expect(isCosmeticId('MARKER_CRIMSON')).toBe(true);
    expect(isCosmeticId('MARKER_TURQUOISE')).toBe(false);
    // Not a property of a plain object either, which `hasOwn` is what makes safe:
    // `in` would have said yes to both of these.
    expect(isCosmeticId('toString')).toBe(false);
    expect(isCosmeticId('__proto__')).toBe(false);
  });

  it('hands back null for a retired identifier rather than throwing', () => {
    // A player who owns a retired cosmetic is not an error: the ledger row that
    // bought it is still true, and a profile screen should draw the default.
    expect(cosmeticById('MARKER_CRIMSON')?.slot).toBe('marker');
    expect(cosmeticById('MARKER_TURQUOISE')).toBeNull();
  });

  it('lists a slot in catalogue order, and only that slot', () => {
    expect(cosmeticsInSlot('markStyle').map((cosmetic) => cosmetic.id)).toEqual([
      'MARK_STYLE_UNDERLINE',
      'MARK_STYLE_BRACKET',
      'MARK_STYLE_CORNER',
    ]);
  });
});

describe('H.6 — what may be worn', () => {
  it('accepts an owned identifier and refuses one merely known', () => {
    expect(canWear(['MARKER_CRIMSON'], 'MARKER_CRIMSON')).toBe(true);
    expect(canWear([], 'MARKER_CRIMSON')).toBe(false);
  });

  it('refuses a retired identifier even to somebody who owns it', () => {
    // Wearing is a new choice, and a new choice is made from what exists now.
    // Nothing is taken away: the purchase is still in the ledger, and
    // `outfitFrom` reads a retired value as the default rather than as an error.
    expect(canWear(['MARKER_TURQUOISE'], 'MARKER_TURQUOISE')).toBe(false);
  });

  it('puts an item in its own slot, whatever the caller thinks', () => {
    // The slot comes from the catalogue, which is the point of doing this here:
    // a handler taking both could put a frame in the marker slot.
    expect(wear(EMPTY_OUTFIT, 'FRAME_DOUBLE')).toEqual({
      marker: null,
      markStyle: null,
      frame: 'FRAME_DOUBLE',
    });
  });

  it('replaces within a slot rather than accumulating', () => {
    const worn = wear(wear(EMPTY_OUTFIT, 'MARKER_CRIMSON'), 'MARKER_AMBER');
    expect(worn.marker).toBe('MARKER_AMBER');
    // And leaves the other slots exactly as they were.
    expect(worn.markStyle).toBeNull();
    expect(worn.frame).toBeNull();
  });

  it('takes a slot back to the default without touching the others', () => {
    const dressed = wear(wear(EMPTY_OUTFIT, 'MARKER_CRIMSON'), 'FRAME_DOUBLE');
    expect(takeOff(dressed, 'frame')).toEqual({
      marker: 'MARKER_CRIMSON',
      markStyle: null,
      frame: null,
    });
  });

  it('does not mutate the outfit it is given', () => {
    const before = { ...EMPTY_OUTFIT };
    wear(EMPTY_OUTFIT, 'MARKER_CRIMSON');
    expect(EMPTY_OUTFIT).toEqual(before);
  });
});

describe('H.6 — reading three stored strings as an outfit', () => {
  it('reads a live identifier in its own slot', () => {
    expect(
      outfitFrom({
        marker: 'MARKER_VIOLET',
        markStyle: 'MARK_STYLE_BRACKET',
        frame: 'FRAME_NOTCHED',
      }),
    ).toEqual({
      marker: 'MARKER_VIOLET',
      markStyle: 'MARK_STYLE_BRACKET',
      frame: 'FRAME_NOTCHED',
    });
  });

  it('reads null, undefined and a retired identifier all as the default', () => {
    // The columns outlive the code that wrote them. A retirement must not be an
    // outage on the profile of everybody who was wearing one.
    expect(outfitFrom({})).toEqual(EMPTY_OUTFIT);
    expect(outfitFrom({ marker: null })).toEqual(EMPTY_OUTFIT);
    expect(outfitFrom({ marker: 'MARKER_TURQUOISE' })).toEqual(EMPTY_OUTFIT);
  });

  it('refuses a value in the wrong slot rather than drawing it there', () => {
    // Nothing writes this — `wear` makes it impossible — but a column outlives
    // its writer, and a screen asking what is in the marker slot must get a
    // marker or nothing, never a frame it will try to draw as a colour.
    expect(outfitFrom({ marker: 'FRAME_DOUBLE' }).marker).toBeNull();
    expect(outfitFrom({ frame: 'MARKER_CRIMSON' }).frame).toBeNull();
  });

  it('keeps the slots it can read when another is unreadable', () => {
    expect(outfitFrom({ marker: 'MARKER_AMBER', frame: 'MARKER_AMBER' })).toEqual({
      marker: 'MARKER_AMBER',
      markStyle: null,
      frame: null,
    });
  });
});

/**
 * Track H's rule, checked rather than reviewed:
 *
 *   "Nothing bought with coins may change a player's chance of winning."
 *
 * A promise in a document is a promise the fifth cosmetic breaks. So the modules
 * that decide an outcome are read as text, and this fails if one of them so much
 * as mentions the catalogue. It is the same technique `purity.test.ts` uses on
 * the clock, for the same reason: nothing goes red at the moment the mistake is
 * introduced.
 *
 * Deliberately a whole-package sweep with an allow-list of two, rather than a
 * list of the files that decide outcomes. A list of guarded files is a list the
 * next scoring module is not on.
 */
describe('H.5 — a cosmetic cannot reach a rule that decides a round', () => {
  const SRC = fileURLToPath(new URL('./', import.meta.url));

  /**
   * The catalogue itself, and the barrel that re-exports it.
   *
   * `index.ts` is a list of exports and decides nothing, so exempting it costs
   * nothing — and it is not a way round the guard: a rule reaching the
   * catalogue through the barrel would still say the word `cosmetic`, which is
   * what is being searched for below.
   */
  const MAY_READ_COSMETICS = new Set(['cosmetics.ts', 'index.ts']);

  /**
   * Prose comes out first, the way `purity.test.ts` does it and for the same
   * reason: several of these files explain what they must not do. Searching the
   * source as written would flag exactly the ones that took the trouble.
   */
  function withoutComments(source: string): string {
    return source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n');
  }

  function sourceFiles(): string[] {
    const found: string[] = [];
    const walk = (dir: string, prefix: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          walk(`${dir}${entry.name}/`, `${prefix}${entry.name}/`);
          continue;
        }
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue;
        found.push(`${prefix}${entry.name}`);
      }
    };
    walk(SRC, '');
    return found.sort();
  }

  it.each(sourceFiles().filter((file) => !MAY_READ_COSMETICS.has(file)))(
    '%s does not read the catalogue',
    (file) => {
      // The word, not the import: a rule reaching the catalogue through the
      // barrel, or through a type alias, still has to name something from it.
      expect(withoutComments(readFileSync(`${SRC}${file}`, 'utf8'))).not.toMatch(
        /cosmetic/i,
      );
    },
  );

  it('sweeps the files that decide an outcome, and not an empty list', () => {
    // The guard above is only worth having if it is looking at the modules that
    // matter. If one of these is ever renamed, this fails rather than the sweep
    // quietly covering nothing.
    const swept = new Set(sourceFiles());
    for (const file of [
      'scoring.ts',
      'grading.ts',
      'hints.ts',
      'items.ts',
      'reducer.ts',
    ]) {
      expect(swept, `${file} is not being swept`).toContain(file);
    }
    expect(swept.size).toBeGreaterThan(10);
  });
});
