# Track F — the screen

The record of **F.7**, and the close of the track. `06-quests.md` keeps the
frame and the step table; `06-quests-steps.md` carries F.1 to F.3,
`06-quests-progress.md` F.4 and F.5, and `06-quests-claim.md` F.6.

## F.7 — the quests screen  ✅

**Done when** a signed-in player can see today's set and this week's, watch a
round move them, and claim a finished one — in both locales, and reachable
without typing a URL.

## A server component, and one client control

The list is one read keyed by the session's own user id, so it renders on the
server and **no endpoint exists whose job is to hand a player's quests to a
browser** — the same shape `/profile` has, for the same reason. The only route
F.7 adds is the one that *writes*.

`ClaimButton` is the smallest thing that has to be a client component, and it
**refreshes rather than re-rendering itself**. `router.refresh()` re-runs the
server component, which re-reads the row and the rounds, so the claimed state a
player sees is the database's answer. An optimistic update would be a second
opinion about whether a claim succeeded, and F.6 exists because that question
has one answer.

## A guest is sent to sign up, and this is not tidiness

Nothing stops the read path drawing a guest a set — a guest holds a real `user`
row, which is 4.3's design. The page refuses anyway, because
`quest_assignment.user_id` cascades and the anonymous plugin **deletes that row
the moment they sign up**. `attachGuestRecords` moves the rounds they played;
nothing moves an assignment, and nothing should.

So a quest given to a guest is a promise that disappears — the same refusal
E.3.2 made about spending a *pseudonym* on an identity about to be deleted. The
three answers are then `/profile`'s exactly: no session signs in, a guest signs
up, an account with no pseudonym chooses one.

## Where the prose lives, and the one sum the screen owns

**The rule carries no sentence** — F.1 — so every label comes from the new
`quests` zone keyed by the rule's identifier, with `{target}` interpolated. A
label is a whole message rather than a noun concatenated onto a figure, which is
`catalogue.ts`'s rule and the only form that survives translation. The zone is
registered in four places, all of which the build checks: `ZONES`,
`CatalogueMessages`, `catalogue.check.ts` — which fails `tsc` on a French key
that is missing or extra — and the test harness.

**Capping the shown progress is the screen's job and F.4 said so.**
`progressFor` returns what a player actually did, because F.6 needs to tell a
quest that is just complete from one passed while a claim was in flight. "5 of
3" is arithmetic nobody asked for, so the minimum is taken at the last possible
moment.

**A claimed row is a statement, not a disabled button.** There is nothing to
click on a quest that has already paid, and at the time the alternative was
`disabled:opacity-40` — the one translucency the direction forbade, since
replaced by a flat fill and a collapsed shadow (`06-structural-debt.md`). The
decision stands on its own reason: a row that has paid is finished, not refused.

**The coin total says what it is worth and what it is for.** Track H owns the
wallet and F.6 credits nothing, so the screen adds up what was claimed and says
plainly that the shop is still being built. A balance shown without that
sentence would be promising something that does not exist.

## The browser journey, and why it plays four rounds

`quests.spec.ts` walks all seven steps: the catalogue's rules, the draw, the row
the read path writes because no cron ever ran for that account, the progress
derived from `participant`, the claim's conditional update, and the screen.

**Four rounds is not arbitrary.** The daily set is three of five rules drawn per
player, and the account is new each run, so *which* rules appear is random. What
is not random is that four perfect rounds meet the maximum target of four of the
five rules — finish four, twelve falsifications at three a round, a round with no
hint, a round marking nothing true. Only `DAILY_SCORE_POINTS` is not guaranteed
by count, and a set holds three rules, so **at least two are certainly
complete**. That is what makes "at least one Claim button" a fact rather than a
hope, and it is why the assertion is a lower bound rather than an exact count.

## The mutation run

Five breakages, five caught: the progress cap removed, claimability read from
`progress > 0` instead of `complete`, the claimed branch deleted, the refresh
dropped after a successful claim, and an unknown error code rendered as a
missing key instead of the unreachable sentence.

The second one failed two cases including the French render, which is worth
noting: the locale test is not decoration — it renders the same tree through a
second catalogue and catches anything that depends on a rendered string.
