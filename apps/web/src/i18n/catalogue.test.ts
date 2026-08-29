// The catalogue layout, held to.
//
// The split is one file per zone and per locale — `messages/<locale>/<zone>.json`
// — so that steps migrating different zones in parallel never rewrite one
// shared file. English is the reference (`next-intl`'s typed keys derive from
// it); the other locales are held to exactly its key set here, because a key
// missing in French is a raw identifier on a French screen — and in the
// attribution it would be a licence violation (step 11.7 adds its own tests).
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { messagesFor, ZONES } from './catalogue.js';
import { LOCALES } from './locales.js';

const MESSAGES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'messages');

function zoneFile(locale: string, zone: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(MESSAGES, locale, `${zone}.json`), 'utf8'),
  ) as Record<string, unknown>;
}

/** Every dotted key path down to the leaves, sorted for a stable diff. */
function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value)
    .flatMap(([key, child]) => keysOf(child, prefix === '' ? key : `${prefix}.${key}`))
    .sort();
}

/** The leaf messages themselves, whatever their nesting. */
function leavesOf(value: unknown): unknown[] {
  if (typeof value !== 'object' || value === null) return [value];
  return Object.values(value).flatMap(leavesOf);
}

describe('11.1 — one file per zone and per locale', () => {
  it.each(LOCALES)('%s holds the declared zones, and nothing else', (locale) => {
    const declared = ZONES.map((zone) => `${zone}.json`).sort();
    expect(readdirSync(join(MESSAGES, locale)).sort()).toEqual(declared);
  });

  it('nests each zone under its own namespace', async () => {
    // The loader is what the request configuration serves; a zone missing here
    // is a screen whose every key falls back to a raw identifier.
    expect(Object.keys(await messagesFor('en')).sort()).toEqual([...ZONES].sort());
  });
});

describe('11.1 — every locale answers the same keys', () => {
  const [reference, ...others] = LOCALES;

  it.each(others.flatMap((locale) => ZONES.map((zone) => [locale, zone] as const)))(
    '%s carries exactly the English keys in %s',
    (locale, zone) => {
      expect(keysOf(zoneFile(locale, zone))).toEqual(keysOf(zoneFile(reference, zone)));
    },
  );

  it.each(LOCALES.flatMap((locale) => ZONES.map((zone) => [locale, zone] as const)))(
    '%s has no empty message in %s',
    (locale, zone) => {
      for (const leaf of leavesOf(zoneFile(locale, zone))) {
        expect(typeof leaf).toBe('string');
        expect(String(leaf).trim()).not.toBe('');
      }
    },
  );
});

describe('11.6 — French is translated, not copied', () => {
  /** [dotted key path, leaf message] pairs, sorted for a stable diff. */
  function entriesOf(value: unknown, prefix = ''): [string, unknown][] {
    if (typeof value !== 'object' || value === null) return [[prefix, value]];
    return Object.entries(value)
      .flatMap(([key, child]) =>
        entriesOf(child, prefix === '' ? key : `${prefix}.${key}`),
      )
      .sort(([a], [b]) => a.localeCompare(b));
  }

  // The messages allowed to read the same in both locales: the brand, proper
  // names, placeholder-only messages, and the handful of words French really
  // spells the same. Everything else reading identically is a paste of the
  // English, which is exactly what a French screen must never show — so this
  // list is exact, not a lower bound: an entry that stops being identical is
  // removed, and a new identical message is either translated or defended here.
  const IDENTICAL_ON_PURPOSE = [
    'home.title',
    'language.names.en',
    'language.names.fr',
    'lobby.entry.brand',
    'lobby.entry.tabs.solo',
    'lobby.entry.topicPlaceholder',
    'lobby.vote.topicPlaceholder',
    'round.debrief.points',
    'round.effects.blizzard.amount',
    'round.effects.lightning.amount',
    'round.effects.rickroll.headline',
    'round.items.cardAria',
    'round.items.rickroll.name',
    'round.itemTarget.title',
    'routes.metadata.siteName',
    'small.chat.tab',
    'small.solo.title',
    'waiting.dino.score',
    'waiting.games.dino.name',
    'waiting.games.snake.name',
    'waiting.reaction.time',
    'waiting.snake.score',
  ];

  it('every message identical to the English is defended by name', () => {
    const identical = ZONES.flatMap((zone) => {
      const english = new Map(entriesOf(zoneFile('en', zone)));
      return entriesOf(zoneFile('fr', zone))
        .filter(([key, message]) => english.get(key) === message)
        .map(([key]) => `${zone}.${key}`);
    }).sort();

    expect(identical).toEqual([...IDENTICAL_ON_PURPOSE].sort());
  });
});
