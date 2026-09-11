# Track I — what the model has cost

The record of **I.6**. `09-admin.md` keeps the frame and the step table; I.1 to
I.5 are in the sheets beside this one.

## I.6 — cost, from `llm_call`  ✅

**Done when** the panel says what the model has been asked to do, per day, per
game and per player.

## Tokens are recorded; money is opted into

`llm_call` records **tokens**, which are a measurement. Nothing in this
repository records what a token costs, and the track asks for *spend*.

A rate written into the source would be wrong within a quarter and **silent
about it** — model prices change, `MODEL_NAME` is itself configurable, and this
repository already objects to hand-written numbers that go stale without saying
(`docs/pages.ts` says so about counts in prose).

So `MODEL_INPUT_COST_PER_MTOK` and `MODEL_OUTPUT_COST_PER_MTOK` are optional and
absent by default. With neither, the section reports tokens and **says on the
screen why it cannot report money**. With both, it multiplies.

**Both or neither.** One rate set and the other forgotten would report a cost
missing its dearer half — output tokens cost more on every provider — and a
number wrong by a factor is worse than an absent one, because it looks like an
answer.

Per *million* tokens, because that is how every provider publishes it: a
per-token figure is six leading zeros in an environment variable, and a typo in
one of them is a report off by ten.

**This is not track H's forbidden price in currency.** H.8's sweep is about the
vocabulary of *selling* — providers, checkouts, invoices, a price on something a
player buys. This is what the game pays a supplier, no player ever sees it, and
it trips none of those patterns.

## Three ways the figure could quietly lie

**A cached game costs nothing.** C4.6 insisted on this and it carries through:
the per-game denominator is games *generated*, not games served, because
averaging in the free ones makes generation look cheaper than it is.

**A failed call still spent.** The tokens went to the model either way, so
failures are counted in the totals rather than filtered out — hiding them would
understate exactly the spend worth cutting. The screen says how many there were.

**A call that reported no tokens is counted separately.** `input_tokens` is
nullable because the model does not always say, and `sum` skips a null — so a
provider that stopped reporting would make the totals *fall* while the spend
rose. The panel says *these figures are missing N calls* rather than quietly
understating.

## `Number('')` is 0, and that is the one wrong answer

An unset variable must read as *no rate*, not as *a rate of nothing*: the second
prices the model at zero and reports a spend that looks like an unusually cheap
month.

`rateFrom` lives beside the rule it feeds rather than in the route, and that
move was forced by a mutation: **a rule in a page file is a rule with no test.**
Removing the empty-string guard passed everything until the helper moved.

## Two smaller things

Kinds are ordered by the **enum's declaration order**, which is what Postgres
sorts by and is the order a round calls them in — alphabetical would put the
verification of a player's report before the falsification it is about.

Every seat counts as a player, guests included: the model was called for their
round too, and leaving them out would divide a real cost by a smaller
population.

## Mutations that must go red

- Half a rate pricing the tokens anyway.
- Cached games in the per-game denominator.
- Failed calls filtered out of the totals.
- Calls with no token count going unreported.
- An empty rate string read as a rate of nothing.
- The no-rate explanation dropped from the screen.
