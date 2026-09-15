# Track N — the article of the day, step by step

The decisions each step made, and what it had to get right. The frame, the four
decisions the track turns on and the step table are in `15-daily-article.md`;
this is what a reader needs once they are in the code.

**Split out on 2026-09-15**, when the track file reached the 200-line rule with
N.5 still to write — the same squeeze that moved the suites out at J.9 and the
promotion out of `08-toolchain-debt.md` this morning, answered the same way.

### N.1 — the table

Keyed by `periodIndexOf('daily')`, the **same calendar as the quests**. Not a
`date` column: a date needs a timezone to mean a day, quests already decided that
question, and two calendars in one product is one of them being wrong somewhere.

The article columns are nullable, which is the claim above. `claimed_at` is not:
a row exists because somebody claimed it, and when is what says whether a claim
has been abandoned — a generation that crashed leaves a row nobody will ever
fill, and N.3 needs to be able to see that rather than serve an empty day for
ever.

### N.2 — the subject, and the filter that is the work

**A title is a candidate, not an article.** `generateArticle` needs three usable
paragraphs, and a disambiguation page, a stub about a village and a list of
episodes all fail it. So candidates are fetched and counted **before anything is
sent to a model**: a rejection costs one Wikipedia request and nothing else,
which is what makes asking for twenty candidates affordable.

**The page comes back, not the title.** The caller is about to falsify it, and
returning a title would mean fetching the same page twice — once to learn it was
usable and once to use it.

**Two bounds, because they bound different things.** `candidates` bounds the
list; `attempts` bounds the *requests*. Without the second, a bad day fetches
fifty pages to find nothing, at the moment somebody is waiting for a round.

**The list ceilings are ours, not the API's.** Asked for 600 on 2026-09-15 both
lists warned *"must be between 1 and 500"* and answered with 500 anyway — so the
clamps prevent asking for five hundred candidates to fetch two, not a refusal.
Checked against the live wiki rather than assumed, after a first draft of this
step asserted a limit that does not exist.

### N.3 — the read path, which is the guarantee

Three answers, and the third is the one that is easy to get wrong:

1. the day has an article → serve it, which is every request but the first;
2. nobody has claimed it → claim it and generate;
3. **somebody else holds the claim → say so, and generate nothing.**

**Three is not a failure.** Calling it one is the mistake this step exists to
avoid: fifty players arriving at midnight would each read *no article today* and,
if the caller retried, each buy one.

**A failed generation gives the claim back at once.** `reopenStaleClaim` needs a
deadline because nothing can tell a crash from work in progress except time; a
generation that failed and knows it has no such doubt, so `releaseClaim` was
added beside it. The difference is a bad minute instead of a bad day.

**The row is read back rather than assembled from what was just written.**
`fillDay` can answer false — a claim released and retaken between the two — and a
caller handed the article it generated would then be reading one nobody else can
see.

**Every model call is recorded on both paths**, C4.5's rule: a generation that
bought nothing was still billed, and dropping the record is what makes the cost
of failure invisible. Against no game, because there is none — the day's article
is not a round until somebody plays it.

### N.5 — the round, and the rule that makes a board mean anything

**It generates nothing.** `startRound` sources an article for a topic a player
typed; this reads the day's, which N.3 already made. So no model call and no
second `recordLlmCalls`: the day was billed once, and recording it again per
round would multiply one generation by however many people played it.

`fromCache` is `true`, and that is not a white lie — C4.6 defines it as *the
article was reused rather than generated*, which is what happened. A daily round
counted as a generation would make the cost per game look higher than it is,
every day, once per player.

**One attempt per account.** A player free to replay until the score is good is
ranked against their own patience rather than against the others, and the top of
the board becomes whoever retried most.

**A guest is not stopped, because a guest has no identity to stop.** Written down
rather than left implicit: it is a hole, and a hole nobody records is one
somebody rediscovers as a bug. The day's board is `user_id`'s, so anonymous play
is outside it in both directions — no attempt spent, no rank taken.

**The link is a column, not a join through `source_url`.** Two rounds can share
an article without sharing a day: the same page may come up again months later,
and the board would then rank a stranger's ordinary round. `game.daily_day`
carries both rules — the one attempt, and the day's board.

**`paragraphs` and `solution` are parsed, not cast.** They are `jsonb`, so
reading them is parsing them: a row written by a hand edit, or by a generator
whose shape has since changed, is refused here rather than discovered at the
insert.

**Two error codes, and neither is `generation_failed`.** `daily_already_played`
says *already played* rather than *not allowed*, because the two read very
differently to somebody who has forgotten they played at breakfast; and
`daily_not_ready` is not a failure of the request — the day is being generated,
or the next request will retry. The protocol's enum is closed and the catalogue
is typed, so both needed a message in both locales before anything compiled.
