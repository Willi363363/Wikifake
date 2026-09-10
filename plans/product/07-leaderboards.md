# Track G — leaderboards

| | |
|---|---|
| **State** | 🔶 G.1 to G.6 — only a player's own rank is left |
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
| G.1 | Region on the profile: derived, overridable | ✅ |
| G.2 | `leaderboard_entry`, written when a round finishes | ✅ |
| G.3 | Periods: daily, weekly, all-time | ✅ |
| G.4 | Queries and their indexes, checked on seeded volume | ✅ |
| G.5 | The board screen, world and regional | ✅ |
| G.6 | Participant threshold and the empty state | ✅ |
| G.7 | Your own rank, and the rows around it | ⬜ |

**What each step decided** is in three sheets: `07-leaderboards-steps.md`
carries G.1 and G.2 — the region, and the entries a board may rank —
`07-leaderboards-queries.md` carries G.3 and G.4, how a board is windowed and
asked for, and `07-leaderboards-screen.md` carries G.5 and G.6. The table above is the
only place that says where a step stands.

**The boards rank room rounds only.** The track offered "separately from
multiplayer, or not at all" and the owner chose the second: a solo topic is one
the player picked. G.5's sheet has the argument, and it is reversible without a
migration.

**G.1 stores three regions rather than six continents**, which narrows what this
frame says above. The reason is the frame's own privacy argument, and it is in
the sheet.

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
