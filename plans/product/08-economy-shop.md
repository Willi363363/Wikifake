# Track H — the shop

The record of **H.7**. `08-economy.md` keeps the frame and the step table;
`-ledger.md` carries H.1 and H.2, `-earning.md` H.3, `-spending.md` H.4,
`-cosmetics.md` H.5, `-ownership.md` H.6.

## H.7 — the shop screen  ✅

**Done when** a player can see what coins are for, buy one thing, and wear it.

## A server component with one client control per row

The shape `/quests` and `/profile` already have, and for the same reason: the
shop is three reads keyed by the session's own user id, so **no endpoint exists
whose job is to hand a player's shop to a browser**. The routes H.7 adds are the
ones that write.

The button refreshes rather than re-rendering itself. `router.refresh()` re-runs
the server component, which re-reads the ledger and the worn columns — so the
balance a player sees afterwards is the database's answer. An optimistic
subtraction here would be a second opinion about a number the ledger owns, and
the ledger exists precisely so that question has one answer.

## The catalogue is the stock

There is no table of what is for sale and no `available` flag. Retiring a
cosmetic is deleting it from the catalogue, and that one deletion gives three
behaviours: nobody can buy it, everybody who owns it still owns it (the ledger
row is still true), and `outfitFrom` reads a worn one as the default. None of
the three is a migration.

## Buying does not wear

**One action, one effect.** A purchase that also changed how the player looks
would make *what does undoing this undo* a question with two answers the moment
H.8's refund seam is real.

The cost is a second click, and it is small because the shop shows every owned
item with a *Wear* button beside it — nothing is hidden. What a player gains is
that buying a second marker to keep for later does not change the one they are
using. There is a test asserting the purchase leaves the outfit alone.

## No price on the wire

`buyCosmeticRequest` carries the identifier and nothing else. A client that sent
a price would be a client whose number the server has to either trust or ignore,
and both are worse than not having it. A test posts a price of 1 and watches the
catalogue's price come out of the ledger.

The response carries `spent`, `balance` and `already`. `balance` comes from the
movement's own `balance_after` rather than from *read minus price*, because
`recordMovement` writes it under a lock and so it is the balance the ledger
settled on even if something else moved coins in between.

## Three refusals, and one thing that is not a refusal

- **Already bought** is a **200**, not a 4xx. H.6's idempotency key is the
  cosmetic, so a second attempt spends nothing — and a refusal would make a
  double-click look like a failure. `already: true`, `spent: 0`.
- **Not enough coins** is `insufficient_coins`, checked before the write and
  said in a sentence. That is the third time in this track, and always for H.1's
  reason: an overdraft arriving as a database error is one nobody can explain.
- **Nothing by that name** is `cosmetic_not_found` — **and the asymmetry with
  the wear path is deliberate.** Wearing answers `cosmetic_not_owned` for both
  unknown and unowned, because telling them apart enumerates the catalogue. A
  *shop* has a public price list, so refusing to say what is in it would be
  secrecy about nothing.

## What the screen decides, and what it refuses to

Four states per row — worn, owned, buyable, too dear — and two of them are
worth the words:

**The price disappears once it is owned.** A number beside something you already
have is a number that invites the wrong arithmetic.

**Too dear is a sentence, not a disabled button.** A control that cannot be used
has to explain itself, and *Not enough coins* says the thing a greyed-out *Buy*
only implies. `readShop` therefore calls an owned item affordable whatever the
balance: *you cannot afford something you already have* is a sentence no screen
should be able to produce.

## The preview is the real thing

A marker swatch is the same hex `ParagraphToken` draws with and a frame is the
same border classes the leaderboard puts round a pseudonym, both read out of
`@wikifake/ui`. A shop that showed an approximation of what you were buying
would be a shop that can lie — so the tests fail if the screen invents either.

Every preview is `aria-hidden`: it says nothing the row's name does not.

## Two limits this step ran into

**The generated REST page crossed 200 lines** at 212, so it is split again —
`rest.md` for the round, `rest-account.md` for the account, the cosmetics and the
shop. The boundary is chosen on the same principle as the first split's, *is
this about playing or about the person playing*, because that is what stays true
as routes are added. A halving would have to be redone next time.

**Two cosmetic names are identical in French**, `Double` and `Violet`, so
`catalogue.test.ts` required them to be defended by name. They are; the other
eight are translated.

## Mutations that must go red

- The balance check removed; the price taken from the request.
- An unknown identifier answered with the wrong code.
- Buying also wearing.
- An owned item called unaffordable; a worn item not marked worn.
- A row offering *Buy* for something unaffordable.
- *Wear* posting a slot as well as an identifier.
- The button refreshing after a refusal.
- The preview inventing a colour or a border instead of reading the design
  system's.
