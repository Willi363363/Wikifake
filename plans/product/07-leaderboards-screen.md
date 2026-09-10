# Track G — the board screen

The record of **G.5**. `07-leaderboards.md` keeps the frame and the step table;
`07-leaderboards-steps.md` carries G.1 and G.2, and
`07-leaderboards-queries.md` carries G.3 and G.4.

## G.5 — the board screen, world and regional  ✅

**Done when** a board can be read for any period and any region, from a URL,
without an account — in both locales.

## Room rounds only, and that was the owner's to decide

The track left it open in as many words: *"a solo game against a self-chosen
topic is ranked separately from multiplayer, **or not at all**."* Put as a fork,
with the reason the track only hints at: **a solo topic is one the player
picked**, and an easy article gives three falsifications found quickly, which is
a high score. A room's topic is voted for, so no single player chooses it.

The owner chose *not at all*. So the boards rank room rounds, and:

- **it is integrity by construction rather than by surveillance**, which is what
  the track asks for at this stage — detecting topic-shopping would need exactly
  the outlier analysis `11-deferred.md` refuses to build yet;
- **it is reversible without a migration.** G.2 writes an entry for every graded
  round, solo included, so turning a solo board on is a parameter — `RANKED_MODE`
  — and not a backfill. A test asserts a solo round with a score of 99,999
  appears on no board *and* that the entry exists;
- **it is said on the screen.** "Room rounds only", with why, and a line telling
  a player their solo rounds still count towards their profile, their quests and
  their streak. A player whose rounds are missing from a board should not have to
  infer the rule from their absence.

## A server component with no client component in it

Worth saying, because a board looks like something that wants tabs and state. It
does not: a period and a region are two rows of **links**, each a different board
at its own address — so it can be opened in a tab, bookmarked and shared, and a
browser with no JavaScript gets every one of them. State would buy a slightly
faster switch and cost the page working at all in the degraded paths C.6
measured.

`aria-current="page"` is how the chosen one is announced; the fill alone would be
visible and not audible. And each link keeps the *other* choice, so switching the
period does not send a regional viewer back to the world board.

`?region=world` is deliberately not a thing: the world board leaves the parameter
off, because `world` is not one of the three regions the protocol declares.

## No session, and that is the decision

Every other screen this effort added is one player's — a profile, their quests —
and is gated and `noindex`. **A board is nobody's.** It is the one page a guest
can look at and want an account because of, so it is readable without one.
Whether it should be *indexed* is track J's call and nothing here depends on the
answer.

A period or region the protocol does not know falls back to the default board
rather than refusing the page: a mistyped URL is not worth a 400 when there is
exactly one sensible answer to give instead.

## The identifiers were promoted, and the periods are now one list

G.3 left `BOARD_PERIODS` in `domain` because nothing outside read them. G.5 puts
a period in a URL, so they moved to `protocol` — the journey the quest rules took
at F.7 and the regions took at G.1. `domain`'s `BOARD_PERIODS` is now *the same
list* rather than a copy of it: the identifiers are the wire's, and what a period
covers is still `boardWindowOf`'s.

## What the mutation run found

Four breakages, four caught: the ranked mode switched to solo (five cases), the
region dropped from the query so every board was the world one (two), the world
board's address carrying `region=world`, and the player count counting entries
instead of players.

## Two guards in this repository found things first

**`apps/web` may not import `drizzle-orm`** — phase 2's exit gate, and the board
test tried to. The one update it needed goes through `setChosenRegion`, G.1's own
query, which is also the path production takes. A better test for it.

**`catalogue.test.ts` requires every French message identical to the English to
be defended by name**, and three of the new ones are: `#`, `Score` and `Europe`.
The list is exact rather than a lower bound, so each had to be declared with a
reason instead of quietly passing.
