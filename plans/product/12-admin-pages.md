# Track K — the admin panel, page by page

Track I built the panel and it works: seven sections, read-only, one range.
They are also all on **one page**, and the owner's verdict on it was that the
UX is bad — everything in one place, nothing findable, and a figure you want
is somewhere below four you do not.

This track does not add a measurement. Every figure it draws already exists in
a reader — `readPlayers`, `readActivation`, `readGames`, `readTraffic`,
`readCost`, `readContent`, `readHealth`. What changes is **where each one is
and what it is next to**.

## How the shapes were chosen

Not from a description. Each candidate was built in the real stack at
`/dev/admin`, on the real tokens, and looked at on a phone — `03-landing.md`
learned the same lesson about a scroll scene and this track started from it.
Eleven rounds, three candidates each time, each candidate stating its own cost
so the comparison was not rigged towards the one the author preferred.

**What was chosen, and the shape it commits to:**

| Page | Chosen | What it means |
|---|---|---|
| The rail | **Boxed groups** | Eight pages under Audience, The game, System — each group its own bordered block, Overview outside all three |
| Overview | **Digest** | Four figures, then the funnel and the arrivals chart |
| Players | **Digest** | Four figures, then the most-active list and new accounts per day |
| Activation | **Funnel** | The two rates as figures, then the funnel itself |
| Arrivals | **Digest + the one-step funnel** | Tiles, then landing → entry with the loss named, then the paired chart |
| Rounds | **Two modes** | Solo and rooms get a card each; the comparison is the page |
| Content | **Digest** | Four figures, the article list, the two failure rates beside it |
| Cost | **Digest** | Spend, the unit costs, the curve, the table by kind |
| Health | **Status board** | One card per service, big; then the commit agreement |

## What the panel must keep saying

These are properties of the numbers, not of the design, and a layout that drops
one of them is wrong however it looks. Each is already written somewhere in
`messages/*/admin.json`; this track moves them, it does not invent them.

- **The period does not move everything.** `activeToday` and `activeThisWeek`
  are fixed windows, `mostActive` is cumulative with no date, and health is a
  live probe. Each says so where it appears.
- **Arrivals counts page loads, not people**, and reach can exceed 100 %.
- **A seat is not a round**, and the abandon rate is a share of seats in
  finished rounds.
- **A topic that came back empty is not a failure.**
- **The most-active list shows a pseudonym, never an address** — E.3.3.
- **No rate lives in the repository.** Money is a multiplication a deployment
  opts into; the panel reports tokens until it does.

## Steps

**This table is the only place that says where a step stands.** Every layout
already exists, working, in `apps/web/src/dev/` — the column says which file to
lift it from, so no step starts by deciding anything.

| # | Step | From the lab | State |
|---|---|---|---|
| K.1 | Eight routes, the rail, the gate on each, indexing decisions | `rail.tsx`, `rail-models.ts` | ✅ |
| K.2 | The period bar, shared, with the custom dialog | `period-bar.tsx` | ⬜ |
| K.3 | Overview — digest | `page-overview.tsx` | ⬜ |
| K.4 | Players — digest | `page-players.tsx`, `PlayersDigest` | ⬜ |
| K.5 | Activation — funnel | `page-activation.tsx` | ⬜ |
| K.6 | Arrivals — digest and the one-step funnel | `page-arrivals.tsx` | ⬜ |
| K.7 | Rounds — two modes | `page-rounds.tsx`, `RoundsModes` | ⬜ |
| K.8 | Content — digest | `page-content.tsx`, `ContentDigest` | ⬜ |
| K.9 | Cost — digest, and the two rate variables in Vercel | `page-cost.tsx`, `CostDigest` | ⬜ |
| K.10 | Health — status board | `page-health.tsx`, `HealthBoard` | ⬜ |
| K.11 | The catalogue: every new string in both locales | — | ⬜ |
| K.12 | Retire `/dev/admin`, `src/dev/` and the `/dev` prefix | — | ⬜ |

## How a page step runs

K.3 to K.10 are the same four moves, and none of them is a decision:

1. **Move the component** from `src/dev/` to `src/admin/`, keeping its name.
   The shared pieces — `parts.tsx`'s `Tile`, `Figure`, `Sparkline`, `Funnel`,
   `PairedBars`, `Key` — move once, on the first page that needs them.
2. **Swap `Sample` for the reader.** Every field the lab draws exists in
   `readPlayers`, `readActivation`, `readGames`, `readTraffic`, `readCost`,
   `readContent` or `readHealth`; `sample-figures.ts` names which. A field that
   does not map is a field to drop, not a query to invent.
3. **Swap the English literals for catalogue keys.** Most already exist in the
   `admin` zone — the section had them. What is new goes in both locales in the
   same pull request, and a message French spells identically is defended by
   name in `catalogue.test.ts` rather than left to look like a paste.
4. **Amend the section's test** with the behaviour. `players-screen.test.tsx`
   and its seven siblings assert the markup of the body being replaced: they
   are rewritten against the new one, never skipped and never deleted.

## What K.2 has to get right

It is the step the other eight lean on, and it carries the one thing the lab
proved by being wrong first.

- **The period stays in the query string**, as I.8 made it. `RangeChooser`
  already follows the page it is on (K.1); K.2 replaces its look, not its
  contract.
- **The presets change.** The owner asked for `24 h · this week · this month ·
  this year · all · custom`. Those are **calendar** periods and `range.ts` is
  **rolling** (7/30/90 days). The two are not the same question, and that is a
  decision to take before the code: `rangeFrom` and `PRESETS` change with it,
  and `range.test.ts` moves with them.
- **The custom dialog is a mockup, not a date picker.** In the lab its two
  dates are fixed and Apply selects one hard-coded range. K.2 is where it
  becomes real, or where it is cut and `custom` leaves `Preset`.
- **Three figures must keep ignoring it.** `activeToday` and `activeThisWeek`
  are fixed windows, `mostActive` is cumulative, health is a live probe. The
  bar says so once for the whole panel so that no page repeats it.

## Entry conditions, and what they cost

**Every page calls `requireAdmin`.** `gate.test.ts` walks
`app/[locale]/admin/` and fails on a page that imports the gate without
calling it — I.1 wrote that rule precisely because I.2 to I.7 were going to
add sections, and this track adds seven routes instead.

**Every page answers `noindex`.** `indexing.test.ts` walks the same tree and
holds each route to a decision in `UNINDEXED_ROUTES`; a route added without
one throws where it renders.

**No write, anywhere.** Track I's sweep reads every source under `src/admin/`
for `.insert(`, `.update(`, `.delete(`, a `POST` and track H's two write
helpers. A panel that can act is a second application, with its own
permissions and its own blast radius.

**Every string through the catalogue.** `catalogue.test.ts` holds French and
English to the same keys, and `apps/realtime` has its own parity test. An
English literal in a screen is a string that never gets translated, which is
how the interface drifted the first time.

## Pitfalls

- **The section components have tests of their own.** Eighteen files under
  `src/admin/`, and several assert the markup of a section this track
  rewrites. They are amended with the behaviour, in the same pull request —
  never skipped, and never deleted to make a suite green.
- **`/admin` keeps its address.** It becomes Overview rather than the whole
  panel; anybody with it in a bookmark lands somewhere that still makes sense.
- **The period lives in the query string**, as I.8 already made it, so a page
  stays shareable. A second control per page would be two screens disagreeing
  about what "this month" meant.
- **The lab is scratch and dies with the decision.** K.12 deletes
  `src/dev/`, its route and the `/dev` prefix in `CRAWLERS_KEPT_OUT`. A
  mockup left in a repository is read as a specification by the next person.
