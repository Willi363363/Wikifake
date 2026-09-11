// Step J.4 — how many people arrived, as a counter and nothing else.
//
// **One row per day per page, and no row per visitor.** The panel of track I
// answers everything downstream of the moment somebody pressed play: accounts
// created, activation, return, rounds, abandon rate, cost. What none of it can
// see is the person who arrived, read the landing and left, because that person
// never touched a table.
//
// This is the smallest thing that answers it, and the shape is the privacy
// decision: a counter cannot be joined to a person, cannot be de-anonymised, and
// holds nothing to export or erase. There is no identifier here — not a cookie,
// not a hash, not an IP — which is also why **it cannot count visitors, only
// views**, and why `10-seo-analytics.md` says so rather than letting a reader
// assume otherwise.
//
// No locale column either. Knowing whether arrivals are English or French would
// be interesting, and the enum for it lives in `apps/web` — a second copy in the
// protocol is the front/back duplication `CLAUDE.md` forbids, for a column
// nothing has asked a question about yet.
import { date, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

export const pageView = pgTable(
  'page_view',
  {
    /**
     * The UTC day, as a date rather than a timestamp.
     *
     * UTC because `periodIndexOf` and the admin range already measure their day
     * that way, and a section disagreeing with the leaderboard beside it about
     * where midnight falls is a section nobody can reconcile.
     */
    day: date('day').notNull(),

    /**
     * Which page, from the closed list in `@wikifake/protocol`.
     *
     * Text rather than a Postgres enum, for the reason `profile.accent` gives:
     * an enum makes adding a page a migration. The list is validated at the
     * route, so nothing unlisted reaches this column — and unbounded values are
     * the thing that must never reach it, since a raw path carries room codes
     * and topics somebody typed.
     */
    page: text('page').notNull(),

    /** How many loads. Incremented in the statement, never read then written. */
    views: integer('views').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.day, table.page] })],
);
