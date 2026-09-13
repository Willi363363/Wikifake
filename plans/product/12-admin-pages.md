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

**This table is the only place that says where a step stands.**

| # | Step | State |
|---|---|---|
| K.1 | The shell: eight routes, the rail, `requireAdmin` on each, indexing decisions | ⬜ |
| K.2 | The period, in the address, shared by every page, with the custom dialog | ⬜ |
| K.3 | Overview — digest | ⬜ |
| K.4 | Players — digest | ⬜ |
| K.5 | Activation — funnel | ⬜ |
| K.6 | Arrivals — digest and the one-step funnel | ⬜ |
| K.7 | Rounds — two modes | ⬜ |
| K.8 | Content — digest | ⬜ |
| K.9 | Cost — digest, and the two rate variables set in Vercel | ⬜ |
| K.10 | Health — status board | ⬜ |
| K.11 | The catalogue: every new string in both locales | ⬜ |
| K.12 | Retire `/dev/admin` and its prefix | ⬜ |

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
