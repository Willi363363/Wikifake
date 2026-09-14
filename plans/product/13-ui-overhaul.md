# Track L — the interface, again

| | |
|---|---|
| **State** | ✅ L.1 to L.8 done — the direction is shipped |
| **Branch** | `feat/ui-overhaul-lab`, then one per step |
| **Depends on** | nothing. It replaces track A's output |
| **Delivers** | an art direction the owner likes, and a navigation that exists |

## Why, in the owner's words

Two complaints, on 2026-09-14, and they are not the same complaint.

**The art direction is wrong.** *"Pas dans son temps et trop IA-like, la palette
de couleur choisie est horrible."* Track A chose playful neo-brutalism and
track B built it; it is eight months of work that lands as generic. That is a
judgement about taste and it is the owner's to make.

**The navigation does not exist.** *"L'accès à la boutique et aux défis est
horrible, il faut plusieurs clics."* Measured rather than assumed:

| Destination | The only path today | Clicks |
|---|---|---|
| Shop | `/` → `/play` → `/profile` → an underlined word in a paragraph | **3** |
| Quests | `/` → `/play` → `/profile` → an underlined word in a paragraph | **3** |
| Leaderboard | `/` → `/play` → an underlined word | 2 |
| Profile | `/` → `/play` → an underlined word | 2 |
| Admin | none, anywhere — the URL typed by hand | ∞ |

**There is no global navigation component in this repository.** Not a bar, not
a menu, not a footer of links. Every route above is reached through prose. So
this track does not shorten a path: it builds the first one.

## What does not change

**The reading surface keeps its exemption.** Track A's one important decision
survives whatever replaces it: the grammar applies to the chassis and never to
the article being judged. A paragraph in a coloured box is a paragraph nobody
reads carefully, and reading carefully is the game. `ReadingSheet` enforces it
by construction and a test holds it by prefix — both stay.

**Nothing announces `/admin` to anybody who is not an admin.** The owner asked
for a visible admin button; I.1 decided no link would exist, because *"an admin
route that announces itself is a target"*. These are compatible and the
implementation is the reason: the button is rendered on the server, only for an
account the `admin` table names, so a non-admin does not receive a hidden
element — they receive nothing. A `hidden` attribute would have been the wrong
answer to the same request.

## How the direction gets chosen

The same way track A's was, because it worked: **candidates built in the real
stack, not described.** Three at a time, on one page, switchable, on real copy
from the catalogue rather than placeholder text, and looked at on a phone.

The owner named the three families to explore and declined to give references —
*"surprends-moi"*:

| | Family | The bet | What it risks |
|---|---|---|---|
| A | Dark, dense, technical | The register of tools people keep open all day; information legible at a glance | A game that looks like a dashboard |
| B | Light, spacious, editorial | Typography carries it; the article is the subject, so the site reads like something you read | Empty at phone width, where most players are |
| C | Sober, near-neutral | The interface disappears behind the content; one colour, reserved for actions | Forgettable — the failure mode of "clean" |

**Each candidate also proposes a different navigation shape**, because the owner
has not decided between a bar and a dropdown: A is a persistent dense bar, B is
a slim bar that becomes a full-screen menu, C is a single dropdown. Choosing a
direction and choosing a navigation are two decisions, and the grid is what
keeps them from being made as one by accident.

## What has been chosen

Recorded here as well as in the code, because track K learned that a decision
living only in a mockup is a decision that dies with the mockup. Five rounds,
three candidates each, every one built rather than described.

| Screen | Chosen | What it commits to |
|---|---|---|
| The direction | **J2** | Tiles with no hairline — a tile is separated by being a different surface. Flat blue, large figures, plenty of air. Light and dark written together |
| The home | **A dense dashboard** | Nothing centred. The streak, the daily lot, the ranking and the last rounds all visible, with Play as the largest tile among them rather than a hero above them |
| The navigation | **A bar at the top** | Every route one click away. Shipped shape still open; the bench has worn a slim bar with a full-screen phone menu since round four |
| The round | **R3 — a rail beside, a bar on a phone** | The wide screen's margin is wasted anyway, so the clock lives there, large; on a phone it collapses to a bar. The article never moves and never changes colour |
| The admin panel | **Unchanged — repainted only** | Track K designed it page by page; nothing about its interface is reopened. The rail, the boxed groups, the eight routes, the period bar and the digests stay exactly as they are, and only the palette follows the new direction |
| The profile | **P2 — one figure leads** | The average score, large: it is the only figure that says whether somebody is improving. Rounds played only says they kept playing |
| The leaderboard | **B2 — your rank pinned on top** | The board answers "where am I" before it answers "who is winning": rank and score in a block above the list, your row still coloured in place |
| The quests | **Q1 — today and the week, side by side** | Two lots kept apart, because they are different promises: a day is something you finish tonight, a week is something you are partway through |
| The shop | **S2 — one grid** | Ten items in one rhythm, the slot as a label, the price on every card. You see what your coins reach without choosing a slot first |

**Four rounds were refused before J, and the reason is worth keeping.** Rounds
one to three changed the palette three times and kept one skeleton — a centred
headline, a sentence, a button, three numbered columns. That skeleton *is* the
cliché the owner kept naming, and no colour rescued it. What broke the deadlock
was changing the arrangement and showing the game's own figures instead of
marketing about them.

## Steps

| # | Step | State |
|---|---|---|
| L.1 | The lab: every screen, three candidates each | ✅ — seven screens chosen |
| L.2 | The direction chosen, and its palette measured before any CSS moves | ✅ — `13-palette.md` |
| L.3 | The tokens, replacing track A's, both themes contrast-checked | ✅ — 42 pairs, all passing |
| L.4 | The navigation, shipped: every route reachable in one click | ✅ |
| L.5 | The admin entry, and the way back from it | ✅ |
| L.6 | Every screen onto the new direction — the game surface | ✅ |
| L.7 | The admin panel **re-tokened**: the palette only, not one control moved | ✅ |
| L.8 | Retire the lab, and the `/dev` prefix with it | ✅ |

**L.7 has a test that proves it rather than a promise.** If nothing but the
palette changes, `players-screen.test.tsx` and its seven siblings keep passing
untouched — they assert the markup track K built. A green suite is then the
evidence that no interface moved, instead of a claim somebody has to take on
trust. Any one of them needing an edit is the signal that the step overreached.

**L.7 kept its promise, and the diff is the evidence.** No file under
`apps/web/src/admin/` ending in `.test.tsx` is in that commit, and 251 assertions
about track K's markup pass untouched. Any one of them needing an edit would
have meant a control had moved.

## What L.6 had to decide that the lab did not

Three things the mockups could not answer, because a mockup has no data and no
forms. Each is a decision rather than a detail, so it is recorded here.

- **The Play tile is the form, not a link to one.** The lab drew it as a block
  saying *Play*; the real screen has to start a solo round, open a room or join
  one. A tile that linked to a start screen would have added the click the whole
  track exists to remove, so the tabs and the fields live on the accent block.
  Its labels are `on-fill` and its inputs stay `surface` — a field tinted to
  match the tile would be text nothing measures.
- **`readHome` composes, and measures nothing.** The dashboard's four figures
  come from `selectPlayerStats`, `readLiveQuests`, `readBoard` and
  `selectGameHistory`, all of which some other screen already reads. Every field
  is nullable and none defaults to nought: a tile saying `0` under *average
  score* tells somebody they are bad at the game rather than that they have not
  played it.
- **The round's controls are one element, not two.** R3 is a rail on a wide
  screen and a bar on a phone, and the obvious implementation — render both,
  hide one by width — puts two clocks and two Submit buttons in the document.
  One node changes position and direction at `lg`; only the topic and the
  altered-count badge drop on a phone, and both are said elsewhere.

**Three guards changed, and each was replaced rather than removed.**
`theme.test.ts` required the dark palette to restate no elevation and to blur
nothing — both true of a shadow drawn as a frame at an offset, both false of
light — so it now requires every elevation restated and every layer blurred, in
both palettes. `fills.test.ts` forbade a hover that lifts; it scans `apps/web`
and not the design system, so it now forbids a *screen* growing its own, and the
gesture is allowed exactly once in `buttonVariants`. The `--border-width-3`
assertion is replaced by one that forbids a border-width token at all.

**L.2 was not a formality, and it earned its hour.** Every pair passes AA, but
`accent` on `surface` in the dark theme came out at 4.81 — ×1.07 of the
threshold, where track A's tightest pair was ×1.54. A margin that thin fails the
next time somebody darkens a tile by a shade, and nothing announces it. The
measured alternative is in `13-palette.md`; the draft would have shipped without
anybody noticing until it broke.

## The lab, and the rule it broke on purpose

K.12 deleted `src/dev/` the day before this track started, with the sentence
*"a mockup left in a repository is read as a specification by the next person"*.
This track built another one. The sentence held, and L.8 is what honoured it:
the lab died with the decision, not after it — `src/dev/`, `/dev/home` and the
`/dev` prefix in `CRAWLERS_KEPT_OUT` are gone in the same commit.

It was ungated while it lived, because it read nothing and rendered a constant.

**Every string comes from the catalogue, even in the lab.** `language.test.ts`
refuses French in the sources, and a mockup drawn on invented copy is a mockup
that flatters itself: real titles are longer than the ones a designer would have
picked.

## How to look at it on a phone

`next dev` does not hydrate over a LAN address — the dev server's socket cannot
complete its handshake, so the page arrives dead rather than slow. Build it:

```bash
pnpm --filter @wikifake/web build
pnpm --filter @wikifake/web exec next start -H 0.0.0.0
```

Then reach the machine's LAN address on the phone. The narrow layouts are CSS
and not state, for the same reason: a layout that needs JavaScript is unreadable
exactly when JavaScript is what broke.
