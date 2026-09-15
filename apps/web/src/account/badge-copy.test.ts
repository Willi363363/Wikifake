// Every badge and every metric has a name, in every locale — step M.2.
//
// `badges.tsx` renders `t(`names.${badge.id}`)` — a key **composed at runtime**,
// so nothing upstream can notice one is missing: `next-intl`'s typed keys cannot follow a template literal,
// `catalogue.check.ts` holds French to English rather than either to a
// catalogue, and `catalogue.test.ts` holds the two locales to each other.
//
// This is the guard F.8 earned, applied to the track that needed it next — a
// badge with no message would render its own identifier to a player with every
// existing gate green. It reads data alone, so it is never skipped.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BADGE_IDS } from '@wikifake/domain';
import { describe, expect, it } from 'vitest';

import { LOCALES } from '../i18n/locales.js';

const MESSAGES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'messages');

function badgesZone(locale: string): { names?: Record<string, string> } {
  const account = JSON.parse(
    readFileSync(join(MESSAGES, locale, 'account.json'), 'utf8'),
  ) as { badges?: { names?: Record<string, string> } };

  return account.badges ?? {};
}

describe('M.2 — the catalogue and the copy say the same badges', () => {
  it.each(LOCALES)('%s names every badge', (locale: string) => {
    const names = badgesZone(locale).names ?? {};

    for (const id of BADGE_IDS) {
      expect(names[id], `${locale}: no name for ${id}`).toBeTypeOf('string');
      expect(names[id]?.trim().length, `${locale}: empty name for ${id}`).toBeGreaterThan(
        0,
      );
    }
  });

  // The other direction. A name left behind by a retired badge is not a failure
  // a player ever sees, so it would sit there for ever and the next reader would
  // take it for a badge that exists.
  it.each(LOCALES)('%s names no badge that is gone', (locale: string) => {
    const known = new Set<string>(BADGE_IDS);

    expect(
      Object.keys(badgesZone(locale).names ?? {}).filter((id) => !known.has(id)),
    ).toEqual([]);
  });
});
