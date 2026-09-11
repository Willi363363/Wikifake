# Track H — the cosmetics catalogue

The record of **H.5**. `08-economy.md` keeps the frame and the step table;
`-ledger.md` carries H.1 and H.2, `-earning.md` H.3, `-spending.md` H.4.

## H.5 — the cosmetics catalogue, in `domain`  ✅

**Done when** there is one place that says what may be bought, in which slot,
for how much — and nothing about what any of it looks like.

## Nothing here has an appearance

A cosmetic is an identifier and a price. What it is drawn as belongs to the
design system, keyed by that identifier.

That is the argument `items.ts` and `quests.ts` both make about names — a rule
carrying a sentence is a rule nobody can translate — and it applies twice as
hard to a hex triplet. **Every colour the interface uses passes a contrast ratio
`packages/ui/src/contrast.ts` asserts.** A palette entry invented in `domain`
would be a colour those tests never see, on the one screen where a player is
reading long paragraphs closely.

So `MARKER_CRIMSON` is the name of a *choice*, not of a colour. A colour word in
an identifier is what `HINT_LOCK` is: stable, greppable, and translated
elsewhere.

## Three slots, and no fourth kind

`marker` (the colour a player is drawn in), `markStyle` (how a marked paragraph
is drawn), `frame` (the border round a pseudonym) — the three the track names.

Each is a place the interface **already draws something**, so a cosmetic
replaces a choice the design system was making anyway rather than adding a layer
to it. That matters for H.6: applying one is picking a value, not introducing a
new element that has to be positioned, sized and made accessible.

**A slot is a presentation slot and the type has no other kind.** Not "no combat
slot for now": there is no member a cosmetic granting an extra hint or a longer
round could declare itself under. Adding one would be a visible change to the
union *and* to the test below, which is the point — the constraint should cost an
argument rather than a code review nobody had.

## The rule with teeth

Track H says *"nothing bought with coins may change a player's chance of
winning"*. A promise in a document is a promise the fifth cosmetic breaks.

So `cosmetics.test.ts` reads **every source file in `domain`** as text, strips
its comments the way `purity.test.ts` does, and fails if any of them says the
word `cosmetic`. Two are exempt: the catalogue, and the barrel that re-exports
it — and the barrel is not a way round it, because a rule reaching the catalogue
through `index.js` still has to name something from it.

A whole-package sweep rather than a list of guarded files, deliberately: **a list
of guarded files is a list the next scoring module is not on.** A second test
asserts the sweep actually covers `scoring.ts`, `grading.ts`, `hints.ts`,
`items.ts` and `reducer.ts`, so a rename cannot leave it quietly covering
nothing.

## Prices, calibrated against earning rather than against each other

A round pays 2 coins and a quest 20 to 150. A cosmetic is meant to be **a week
of the retention loop, not an afternoon**: 150 is roughly a week of dailies
claimed, or a fortnight of playing without ever opening the quest screen.

Held mechanically, not by this paragraph. The test reads `COINS_PER_ROUND`,
`COINS_PER_PERFECT_ROUND` and every quest's reward, and asserts the cheapest
cosmetic costs more than the best single round and at least the richest quest.

**The spread within a slot is flat**, and that is a decision: a marker costing
three times another marker says one of them is better, and none of them is. What
varies is the slot — a frame is seen by everybody who reads a leaderboard, a
mark style by the player alone. A test holds each slot to one price.

**No free entry**, and that is a rule rather than an omission: what every player
starts with is the design system's own choice, which is not an item and cannot be
bought, sold or lost. A price of zero would be a purchasable nothing — and a
`coin_movement` of nothing, which H.1's check refuses anyway.

## Reading an identifier back

The column that will hold one is `text`, for the reason `quest_assignment.rule_id`
is: an enum would make retiring a cosmetic a migration. So a stored value can
outlive its definition, and `cosmeticById` returns **null rather than throwing**.

A player who owns a retired cosmetic is not an error — the ledger row that bought
it is still true, and a screen that cannot draw it should draw the default. A
throw would make a retirement an outage on the profile of everybody who bought
one.

`isCosmeticId` uses `Object.hasOwn`, not `in`: `in` says yes to `toString` and
`__proto__`, which a test names.

## What this step did not do

No ownership, no wearing, no shop. H.6 owns ownership and applying one, H.7 the
screen. **The room's colour collision is H.6's question** and is written down
here rather than answered: `assignColour` hands out a distinct `PLAYER_COLOURS`
entry per arrival so that two players in a room are told apart, and an owned
marker cannot be allowed to break that.

## Mutations that must go red

- A rule reaching the catalogue, including through the barrel.
- A cosmetic priced at zero.
- One item in a slot priced above its neighbours.
- A cosmetic cheap enough to buy in two rounds.
- An identifier whose prefix disagrees with its slot.
