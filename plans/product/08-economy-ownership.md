# Track H — ownership, and wearing one

The record of **H.6**. `08-economy.md` keeps the frame and the step table;
`-ledger.md` carries H.1 and H.2, `-earning.md` H.3, `-spending.md` H.4,
`-cosmetics.md` H.5.

## H.6 — ownership, and applying a cosmetic  ✅

**Done when** a player owns what they bought, wears one thing per slot, and the
game draws it.

## Ownership is derived from the ledger

Owning a cosmetic is **having a `cosmetic_purchase` movement for it**. There is
no `cosmetic_ownership` table.

That is H.1's own argument applied a second time: a balance is the sum of its
movements and never a column somebody can write, and *what somebody owns* is the
same kind of fact. A second table would be a second place that can disagree, and
reconciling the two is work nobody schedules until the day it is urgent. What it
buys is the question a player actually asks — *why do I own this* — answered
from the same rows as *where did my coins go*.

**The idempotency key is the cosmetic.** `cosmetic:<id>` per player, so a
double-click pays once — the unique index of H.1 doing the job a
`unique(user_id, cosmetic_id)` would have done on the table this step chose not
to build.

**The cost is one index**, and it is paid in full: `coin_movement_owned_idx` on
`(user_id, reference)` partial on `source = 'cosmetic_purchase'`. Partial because
a purchase is a handful of rows in a ledger that grows by two coins every round.
The test **drops the index and watches the plan turn into a scan**, rather than
asserting a shape and hoping.

**A grant with no payment is two rows, not a special case**: an `adjustment`
crediting the price and the purchase spending it. The balance is unchanged, the
ledger explains itself, and track I's admin panel needs no new mechanism. There
is a test for exactly that.

## Wearing: three columns, and null means the default

`profile.worn_marker`, `worn_mark_style`, `worn_frame`. Columns and not a
`preferences` key, by that column's own rule: `jsonb` is for preferences nothing
queries, and a board drawing fifty pseudonyms reads the frame of every one of
them in the same query.

**Null is not "no cosmetic" — it is the design system's own choice**, which is
why H.5 refused a free catalogue entry. `text` and no foreign key: an enum would
make retiring a cosmetic a migration, and there is nothing for a key to point at
since ownership is derived. So the check that a player owns what they wear is
made in the handler, where the answer is known.

`outfitFrom` reads the three strings and returns the default for null, for a
retired identifier, **and for a value in the wrong slot**. Nothing writes that
last case — `wear` takes the slot from the catalogue — but a column outlives its
writer, and a screen asking what is in the marker slot must get a marker or
nothing, never a frame it will try to draw as a colour.

## The marker is worn everywhere except a room

`assignColour` hands out a distinct `PLAYER_COLOURS` entry per arrival so two
players can be told apart. A bought colour cannot be allowed to break that, and
the two alternatives were both worse: *honoured when free* means a player
sometimes does not see what they paid for, which is the worst thing to have to
explain; *a reserved palette* means two sets of colours the design system has to
keep distinguishable from each other.

So the rule is **which caller passes the outfit**: `solo.tsx` does,
`lobby/room.tsx` does not. There is no setting to get wrong, and a test reads
both files to hold it.

## The rule that makes selling colours safe

**A cosmetic may only colour a decoration that carries no text.**

The marked paragraph is `bg-accent-soft` with `ink` on it, a pair in
`CONTRAST_PAIRS` at 19.31:1, and nothing here touches it. What a marker colours
is the bar *under* the paragraph — `aria-hidden`, childless, a rectangle. So the
bar is WCAG 1.4.11's 3:1 non-text contrast, not AA, and a test asserts the
token's own classes are **identical** dressed and bare.

**The 3:1-on-both-grounds rule decided the palette, and it was measured.** One
hex clearing 3:1 against near-white *and* near-black sits in a narrow band of
luminance: the first four candidates were `#c1121f`, `#b45309`, `#6d28d9` and
`#334155`, and three failed on the dark page at 1.8:1 to 2.4:1. Everything that
passes lands at the same balance point, so **the four markers are told apart by
hue alone** — normally the thing this design system refuses. The difference is
what is lost: a verdict nobody can tell apart is a verdict they cannot read; two
marker colours nobody can tell apart is two players who both like red.

Appearances live in `packages/ui`, which depends on no `@wikifake` package — so
the catalogue cannot check the appearances and vice versa. The test that every
identifier is sold *and* drawn lives in `apps/web`, the first place both are in
scope, and it is the place that would break.

## Mutations that must go red

- The handler skipping the ownership check.
- `wear` taking the slot from anywhere but the catalogue.
- `outfitFrom` trusting a value in the wrong slot.
- The partial index dropped.
- The derivation forgetting `source` — a quest reward would become a cosmetic.
- Solo not passing the marker; the room passing one.
- A marker colour that fails on the dark page.
- A mark style that paints behind the prose.
