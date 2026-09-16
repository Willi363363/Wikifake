// Step 11.10 — one word per concept, in French.
//
// The build already holds the French catalogue to the English one: a key that
// exists in one and not the other fails to compile. What it cannot see is the
// catalogue being **complete and inconsistent** — two French words for one thing
// in the game, each correct on its own line.
//
// That is what a reading found, and it was not subtle once seen. A player
// pressed *"Ouvrir une salle"*, arrived on a screen headed *"Salle"*, and was
// answered by the server with *"Ce salon n'est pas ouvert."* The lobby and the
// chat used one word; every refusal, the leaderboard, the quests, the shop and
// the FAQ used the other. Twelve against eighteen.
//
// So this is the rule rather than the memory of it, in the shape
// `admin/gate.test.ts` uses for its own: **a habit somebody remembers is a
// habit, and one a case enforces is a rule.** A new message that reaches for the
// other word fails here, with a sentence saying which word to use instead.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const FRENCH = fileURLToPath(new URL('../../messages/fr/', import.meta.url));

/**
 * One concept, one word — and the words it must not drift back into.
 *
 * Deliberately short. This is not a style guide and it should never become one:
 * every entry costs a reader a rule to obey, so an entry earns its place by
 * having actually drifted, or by having been close enough to be worth writing
 * down while somebody had checked.
 */
const GLOSSARY: readonly {
  readonly concept: string;
  readonly use: string;
  readonly notThese: readonly string[];
  readonly because: string;
}[] = [
  {
    concept: 'a multiplayer room',
    use: 'salon',
    notThese: ['salle', 'salles'],
    because:
      'it is the word every refusal in errors.json already uses — the sentences ' +
      'a player meets at the worst moment — and it is the idiomatic French for a ' +
      'lobby, where "salle" reads physical',
  },
];

/**
 * Words that look like drift and are not, kept so the next reader does not
 * spend an afternoon rediscovering it.
 *
 * Each was counted, looked at in context, and dismissed. They are asserted
 * rather than only commented, so a real collision later — `jeton` used for the
 * game's currency, say — is a failing case rather than a note nobody reads.
 */
const NOT_DRIFT: readonly { readonly words: readonly string[]; readonly why: string }[] =
  [
    {
      words: ['pièce', 'jeton', 'crédit'],
      why: "three concepts, not three translations: the game's coin, the model's tokens on the cost page, and an attribution credit in the legal texts",
    },
    {
      words: ['manche', 'partie'],
      why: 'the English distinction, kept faithfully: round → manche, game → partie',
    },
  ];

/** Every French message, flattened, keyed by file and path. */
function frenchMessages(): { name: string; text: string }[] {
  const found: { name: string; text: string }[] = [];

  const walk = (value: unknown, at: string): void => {
    if (typeof value === 'string') {
      found.push({ name: at, text: value });
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    for (const [key, held] of Object.entries(value)) walk(held, `${at}.${key}`);
  };

  for (const entry of readdirSync(FRENCH)) {
    if (!entry.endsWith('.json')) continue;
    walk(
      JSON.parse(readFileSync(`${FRENCH}${entry}`, 'utf8')),
      entry.replace('.json', ''),
    );
  }
  return found;
}

describe('11.10 — the French catalogue says one thing one way', () => {
  it('found the messages, so the rules below are not vacuous', () => {
    const messages = frenchMessages();
    expect(messages.length).toBeGreaterThan(700);
    // A word from the glossary is actually in use, so a rule that passes because
    // the catalogue is empty would be caught here instead.
    expect(messages.some((message) => /\bsalon\b/iu.test(message.text))).toBe(true);
  });

  it.each(GLOSSARY)('a $concept is a "$use"', ({ use, notThese, because }) => {
    const offenders = frenchMessages().filter((message) =>
      notThese.some((word) => new RegExp(`\\b${word}\\b`, 'iu').test(message.text)),
    );

    expect(
      offenders.map((message) => `${message.name}: ${message.text}`),
      `say "${use}" rather than ${notThese.map((word) => `"${word}"`).join(' or ')} — ${because}`,
    ).toEqual([]);
  });

  it.each(NOT_DRIFT)(
    '$words are not one concept spelled three ways',
    ({ words, why }) => {
      // The assertion is that they all still exist and are all still used: if one
      // disappeared, somebody has "unified" a distinction this catalogue makes on
      // purpose, and the reason above is what they should read first.
      const messages = frenchMessages();
      for (const word of words) {
        expect(
          messages.some((message) => new RegExp(`\\b${word}`, 'iu').test(message.text)),
          `"${word}" has gone from the catalogue — ${why}`,
        ).toBe(true);
      }
    },
  );
});
