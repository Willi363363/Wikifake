# Track O — O.4 to O.6, what a round and a page cost

The three remaining steps of `16-hardening.md`, which keeps the frame and the
step table. O.4 is a deadline nothing has; O.5 and O.6 are the two measurements
of `../current-state/09-query-debt.md`, which is where their numbers live.

All three are done.

### O.4 — a generation that ends

No `AbortSignal` on the Wikipedia calls, none on the model call, no
`maxDuration` on any route. `server.ts` guards the multiplayer generation with a
`.catch`, and its comment names the failure it is for: *a room left in
`generating` waits for an article that is not coming*. **A hang is not a
rejection**, so the guard never runs and the room waits for the idle alarm, an
hour later. Solo holds the request open instead.

**One deadline for the whole chain**, not one per call: what a player
experiences is the wait, and three bounded steps still add up to three times the
bound. `sourceArticle` creates it with `AbortSignal.timeout` and hands the same
signal to `searchTitles`, `fetchRenderedPage` and `falsify`. A timed-out
generation then *is* a rejection, which is what every caller already handles —
`callApi`'s catch turns it into `unreachable` and `falsify`'s into a failure
that is still billed, because the tokens were spent.

Started **after** the cache lookup, so a hit costs no network and cannot expire.

`GENERATION_DEADLINE_MS` is forty-five seconds, and the number is the part to
argue with. A search and a page are a fraction of a second each when Wikipedia
is well; the falsification of four paragraphs is what varies. So it has to clear
a *slow* model rather than a typical one — cutting a legitimate generation short
costs the round, and waiting only costs a spinner. Long as a spinner, short as
the hour a room in `generating` used to wait.

**It lives in `@wikifake/article`, not in `@wikifake/domain`** as this sheet
first proposed. `domain` is a devDependency of that package, so importing it at
runtime would add an edge to the workspace graph — which `workspace-graph.test.ts`
holds — for one number nothing outside the chain reads.

`maxDuration = 60` on the three routes that can generate is the backstop under
it: the chain's own deadline is the one that should fire, because it ends in a
refusal the player can read.

**One thing it fixed that was not on the list.** A search that could not be
*reached* was reported as `topic_not_found` — so a timeout told a player their
subject was not on Wikipedia, and told a room to try the next candidate against
the same silence, spending the whole deadline again per candidate. The
distinction already existed for the page fetch; it only had to be asked for the
search too.

**The test is the hang.** Two of its five cases do not fail without the fix —
they never finish, which is the defect exactly. Run against a 50 ms deadline
rather than forty-five seconds, with a transport and a model that honour a
signal and answer nothing otherwise.

### O.5 — an event that changes nothing writes nothing

Measured: a room in a round holds **20.3 KiB** of state, because `RoundState`
carries the article and the solution; `cursor` returns that state **unchanged**;
and `apply` serialises and rewrites it anyway, under a compare-and-swap that
bumps the revision. Four players at the clients' own pacing move ~2.6 MB/s
through Redis, none of which changes anything — and the revisions they burn are
what make a real event lose its ten retries and tell the player the room is gone.

**The narrow fix was the honest one: when the reducer returns the state it was
given, publish the effects and skip the write.** It changes no rule, and it
removes the write, the revision bump and the contention in one line.

The check is **reference identity**, and that is not a shortcut — it is the
reducer saying so itself. `emit(state, …)` in `reducer.ts` hands back the state
it was given, so `cursor`, `live_score`, `chat_message`, `get_lobby` and every
refusal return the same object; `set_ready` does not. Probed before relying on
it. Identity can only ever skip a write the reducer literally declined to make:
a change returned as a new object is still written, and a change made by
mutating in place would be a bug in a package whose purity has its own test.

Measured with the probe that found it, four players at the clients' own 60 ms
pacing, four seconds, on a room in a round holding 20.3 KiB:

| | applies | revisions burnt | state written |
|---|---|---|---|
| before | 260 | 260 | **5.15 MiB** |
| after | 256 | **0** | **0** |

And read back again each time, so the traffic saved is twice that.

**The two traps the sheet named, both real, both held by a case:**

- **The TTL.** The swap refreshed the key's expiry as a side effect of
  committing, so an event that no longer commits would no longer refresh it and
  a room whose only traffic is cursors and chat would expire underneath the
  players making it. `TOUCH_SCRIPT` is one `PEXPIRE` under the same revision
  guard as the other two — a whole state's worth of write replaced by a command.
- **The idle clock** is the scheduler's, not the store's: `armFor` re-arms
  `room_idle` from `server.ts` on every event, so skipping the write never
  touched it. Stated rather than discovered.

Re-arming BullMQ twice per event is the other half of the per-frame cost, and it
is **left for later on purpose**: it is a change to what an alarm means, not to
what a write costs, and this step was already the largest here.

### O.6 — the session, read once a request

Measured: `/fr/profile` runs nine queries and six of them are the same `session`
and `user` rows, read three times with identical parameters. `/fr/shop` eleven,
`/fr/quests` sixteen, same six. Three callers that do not know about each other:
`adminHere()` in the layout — on every page since L.5 — the page itself, and
`readViewer()`.

**React's `cache()` was taken, and `cookieCache` was not.** The first is what
the finding is about: three callers asking the same question in one render pass,
none of them wrong to want the answer. `currentSession` in `src/auth/session.ts`
is the memo, and the Next 16 documentation names `React.cache` as the way —
checked in `node_modules/next/dist/docs/` rather than remembered, because this
version's conventions are not the ones training data holds.

Measured the same way as the finding, on the same pages:

| Page | Queries before | after | session + user before | after |
|---|---|---|---|---|
| `/fr/profile` | 9 | 5 | 6 | **2** |
| `/fr/shop` | 11 | 7 | 6 | **2** |
| `/fr/quests` | 16 | 8 | 6 | **2** |
| `/fr/leaderboard` | 8 | 6 | 4 | **2** |

Two is the floor for "who is asking": one `session` row and one `user` row.

**`cookieCache` would take it to nought, and this step refuses it** — which is a
decision rather than an omission. It puts the session in a signed cookie for a
window, and `gate.ts` opens with this project's own position on exactly that:
*"Read on the server, every time, and never cached into a cookie … what a stale
copy buys is a player who is shown somebody else's name after a claim lost a
race."* That sentence was written about the pseudonym and the argument carries.
The anonymous plugin is the aggravating detail: a guest signing up has their
`profile` row deleted and their records re-attached, so the one identity this
application rewrites underneath itself is the one a cached copy would be stale
about. Worth revisiting against a measurement from production rather than
against two round trips on a loopback.

**The test is a count, not a stopwatch.** A timing assertion measures the runner
— the argument `10-test-debt.md` makes about `until` — so what is locked is *who
may ask*: `session.test.ts` reads every server source under `app/`, `account/`,
`admin/` and `auth/` and fails on any that reads the session from its own
headers. It is the shape `admin/gate.test.ts` already uses, and for the same
reason: a page that asks for itself is wrong in no way a type can see, and puts
back exactly the six reads this step measured away.
