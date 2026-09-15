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

### N.4 — the cron, and the claim that died

**It makes nothing the read path could not make on demand**, which is F.5's rule
inherited whole: `ensureDailyArticle` generates the day for whoever asks first,
so this run is a pre-warm and never a prerequisite. Stop it for a week and every
day still has its article; what players lose is the wait on the first request of
each morning.

Both properties are free rather than engineered. **Idempotent**, because the
claim is a primary key. **Self-healing**, because the guarantee was never here.

**`generated` is asked before, not read from the outcome.** A second run also
ends `ready`, so reading the outcome alone would report every run as the one that
made the day — and the idempotence this step promises would be invisible in
exactly the log meant to show it. The question is not *is there an article*, it
is *did this run make one*. A first draft got that wrong and its expression
simplified to "the day is ready".

**The sweep is on the read path too, and that is the finding.** N.3 answered
`generating` for a claim whose generation had died, for ever — so a claim that
died at 00:06 would hold the day until tomorrow's cron. The read path now takes a
claim back once it is past the deadline, **once and not in a loop**: a second
caller arriving in the same instant loses the retaken claim and answers
`generating`, which is true.

**Ten minutes, chosen from both sides.** A generation is a handful of Wikipedia
requests and one model call: one that has not finished in ten minutes has not
finished at all, so the deadline cannot take the day from work in progress. And a
claim that did die costs the day ten minutes rather than until tomorrow.

**It shipped as a `POST` and would never have run.** Vercel's scheduler issues a
`GET` — `cron/quests` says so in the comment beside its own method — so the
schedule would have fired every morning at 00:10 against a route that answers
405, and nothing would have said a word: the read path covers every day anyway,
so the only symptom would have been a first player waiting, for ever, with no
failure anywhere. `route-parity.test.ts` caught it, because a route served under
a method the catalogue does not describe is exactly what it refuses.

**What the cron still does that the read path cannot**: yesterday's dead claims.
Nobody asks for yesterday's article, so the read path's recovery never fires on
it, and the row would sit there as a claim nobody can fill.

---

**The steps that make a day playable — N.5, N.6 and N.7 — are in
`15-daily-article-playing.md`.** Split out on 2026-09-15, when this file reached
the 200-line rule with N.4 still to write.
