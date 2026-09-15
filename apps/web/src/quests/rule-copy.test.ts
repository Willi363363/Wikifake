// Every quest rule has a sentence, in every locale — step F.8.
//
// `screen.tsx` renders `t(`rules.${quest.ruleId}`)`. The key is **composed at
// runtime**, so nothing upstream can notice it is missing: `next-intl`'s typed
// keys cannot follow a template literal, `catalogue.check.ts` holds French to
// English rather than either to the catalogue, and `catalogue.test.ts` holds the
// two locales to each other. A rule added to `@wikifake/domain` with no message
// therefore renders its own identifier to a player, and every existing gate
// stays green.
//
// F.8 added six rules at once, which is exactly the moment that costs something.
// The assertion runs on data alone — no Postgres, no Redis — so unlike its
// neighbour in `quests.test.ts` it is never skipped.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { QUEST_RULE_IDS } from '@wikifake/domain';
import { describe, expect, it } from 'vitest';

import { LOCALES } from '../i18n/locales.js';

const MESSAGES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'messages');

function rulesFor(locale: string): Record<string, string> {
  const zone = JSON.parse(
    readFileSync(join(MESSAGES, locale, 'quests.json'), 'utf8'),
  ) as { rules?: Record<string, string> };

  return zone.rules ?? {};
}

describe('F.8 — the catalogue and the copy say the same rules', () => {
  it.each(LOCALES)('%s has a sentence for every rule', (locale: string) => {
    const rules = rulesFor(locale);

    for (const id of QUEST_RULE_IDS) {
      expect(rules[id], `${locale}: no message for ${id}`).toBeTypeOf('string');
      expect(
        rules[id]?.trim().length,
        `${locale}: empty message for ${id}`,
      ).toBeGreaterThan(0);
    }
  });

  // The other direction. A message left behind by a retired rule is not a
  // failure a player ever sees, so it would sit there for ever — and the next
  // reader would take it for a rule that exists.
  it.each(LOCALES)('%s has no sentence for a rule that is gone', (locale: string) => {
    const known = new Set<string>(QUEST_RULE_IDS);

    expect(Object.keys(rulesFor(locale)).filter((id) => !known.has(id))).toEqual([]);
  });

  // Every rule states its target, and it is the one thing the sentence must
  // carry: the generator draws the number, so a message without the placeholder
  // is a quest whose goal is invisible.
  it.each(LOCALES)('%s names the drawn target in every sentence', (locale: string) => {
    const rules = rulesFor(locale);

    for (const id of QUEST_RULE_IDS) {
      expect(rules[id] ?? '', `${locale}: ${id} does not say {target}`).toContain(
        '{target}',
      );
    }
  });
});
