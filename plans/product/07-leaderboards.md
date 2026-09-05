# Track G — leaderboards

| | |
|---|---|
| **State** | ⬜ not started |
| **Branch** | `feat/leaderboards` |
| **Depends on** | track E |
| **Delivers** | a world ranking and a regional one |

## Objective

A world ranking, and a regional one — Europe, the Americas, and the rest.

## Region without location data

A region is derived from the **country code the CDN already puts on the
request** (`x-vercel-ip-country`), mapped to a continent and stored as that
continent on the profile. Nothing finer is read, nothing finer is stored.

This matters for the reason track E's field list matters: a coarse region
derived from an existing header is a very different thing, legally and
ethically, from geolocating a player. A player can also set their region by
hand and that choice wins — which is both correct for travellers and the
simplest answer to anybody who objects to the inference.

## The thresholds nobody thinks about until launch

A leaderboard with four entries makes a game look abandoned. Two rules, held
in code:

- **A board is hidden below a participant threshold.** Under it, the screen
  says the ranking opens soon rather than showing three names.
- **A board is a period, not all of history.** Daily, weekly, all-time. An
  all-time board alone is a wall the first hundred players build against
  everybody who arrives later.

## Anti-cheat, at the level this game deserves

The server already grades and already computes score — the rewrite made that
non-negotiable and it is why a leaderboard is possible at all. What this track
adds is modest and sufficient:

- Only scores from **finished, server-graded rounds** are ranked.
- A solo game against a self-chosen topic is ranked separately from
  multiplayer, or not at all. The two are not comparable.
- Rate limits already exist on the socket; nothing here bypasses them.

Anything beyond that — replay validation, statistical outlier detection — is
disproportionate until the game has enough players to make cheating rewarding.
Recorded in `11-deferred.md` rather than built.

## Steps

| # | Step | State |
|---|---|---|
| G.1 | Region on the profile: derived, overridable | ⬜ |
| G.2 | `leaderboard_entry`, written when a round finishes | ⬜ |
| G.3 | Periods: daily, weekly, all-time | ⬜ |
| G.4 | Queries and their indexes, checked on seeded volume | ⬜ |
| G.5 | The board screen, world and regional | ⬜ |
| G.6 | Participant threshold and the empty state | ⬜ |
| G.7 | Your own rank, and the rows around it | ⬜ |

### G.4 — Indexes before the screen

Ranking queries are the first thing in this project that gets slow with real
volume. The index goes in with the query, and it is checked against a seeded
table of a size the game does not have yet — because the alternative is
discovering it on the day the game finally has players.

## Exit gate

- A finished multiplayer round appears in the world board within a minute.
- The regional board matches, for a player whose region was overridden by hand.
- Under the threshold the board says so, rather than showing three names.
- The queries hold their plan on a seeded table two orders of magnitude larger
  than today's.
- An unfinished or abandoned round is ranked nowhere.
