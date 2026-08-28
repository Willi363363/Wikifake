// The catalogue, split by zone.
//
// One JSON file per zone of the interface and per locale —
// `messages/<locale>/<zone>.json` — never one shared file. The zones are
// screens that later steps migrate in parallel (lobby, round, waiting, …), and
// two branches rewriting one `en.json` is a merge conflict by design. A zone
// file is owned by the step that migrates that zone; this list is the only
// line two such steps both touch.
//
// A catalogue entry is a whole message with placeholders, never a fragment to
// concatenate: sentences built from pieces do not survive translation.
import type home from '../../messages/en/home.json';
import type seo from '../../messages/en/seo.json';
import type language from '../../messages/en/language.json';
import type routes from '../../messages/en/routes.json';
import type small from '../../messages/en/small.json';
import type lobby from '../../messages/en/lobby.json';
import type round from '../../messages/en/round.json';
import type waiting from '../../messages/en/waiting.json';
import type { Locale } from './locales.js';

/** The zones migrated so far. Step 11.2 grows this list, one entry per zone. */
export const ZONES = [
  'home',
  'round',
  'waiting',
  'lobby',
  'small',
  'routes',
  'language',
  'seo',
] as const;

export type Zone = (typeof ZONES)[number];

/**
 * The message shape, defined by the English catalogue.
 *
 * English is the reference: `next-intl`'s typed keys are derived from this
 * shape (see `next-intl.d.ts`), so a key missing in English is a compile
 * error, and `catalogue.test.ts` holds French to the same key set.
 */
export type CatalogueMessages = {
  home: typeof home;
  round: typeof round;
  waiting: typeof waiting;
  lobby: typeof lobby;
  small: typeof small;
  routes: typeof routes;
  language: typeof language;
  seo: typeof seo;
};

/** Every zone of one locale, loaded and nested under its namespace. */
export async function messagesFor(locale: Locale): Promise<CatalogueMessages> {
  const entries = await Promise.all(
    ZONES.map(async (zone) => {
      // A template literal on purpose: webpack turns it into a context of the
      // `messages/` tree, so a new zone file ships without a new import line.
      const loaded = (await import(`../../messages/${locale}/${zone}.json`)) as {
        default: Record<string, unknown>;
      };
      return [zone, loaded.default] as const;
    }),
  );
  return Object.fromEntries(entries) as CatalogueMessages;
}
