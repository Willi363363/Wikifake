# Track I — the health section

The record of **I.2**. `09-admin.md` keeps the frame and the step table;
`09-admin-role.md` carries I.1.

## I.2 — health, from the existing probes  ✅

**Done when** an admin can see whether both services are up, on which commit,
and how slow — without anything new being instrumented to tell them.

## Nothing new is instrumented, and that is the step

`/api/health` is already the contract `deploy-check.yml` polls after every push,
and **both services answer the same shape at the same path** — one contract
rather than two, which C7.2 decided years before this panel existed. The section
reads it. That is why this is the cheap section the track promised.

## Three rules, and each is about what a health page is *for*

**A failure is a value, not an exception.** A probe that throws takes the page
with it, so the one screen that exists to say what is broken goes blank exactly
when something is. Every probe returns a reading, and an unreachable service is
a reading that says so — with the message and not the stack, because a stack
trace on an admin screen is a stack trace in a screenshot.

**Every probe has a deadline.** A service that has stopped answering does not
refuse; it hangs, and a page without a timeout inherits the hang. Two seconds.

**They run together**, so the page's latency is the slowest probe rather than
the sum. The exit gate asks for the panel in under a second, and one asleep
free-tier service would eat that alone.

## What each probe is, and is not

**The web app is not asked over HTTP.** This code *is* the web app: a request to
itself would measure a round trip and prove nothing that rendering the page has
not already proved. Its reading comes from `deploymentIdentity()`, and its `ms`
is zero because there is nothing to time.

**The socket service is read through the protocol's schema**, not as loose JSON.
A service answering something else is *down* rather than a page rendering
`undefined` — the same decision `deploy-check.yml` made about this contract. The
URL is the configured socket one with `ws` swapped for `http`, because the health
path is not a socket.

**The database probe is `select 1` and nothing else.** Not a count: a probe whose
time depends on how much data there is answers a different question. It lives in
`@wikifake/db` as `pingDatabase`, because `apps/web` may not import
`drizzle-orm` — phase 2's exit gate, and a health probe is no exception to it.

## The figure the section exists for

**Do the two services agree about what is deployed.**

`deploy-check.yml` asserts it once per push. Here it answers the question that
outlives the push: the web app deploys in seconds and the socket service does
not, so *the halves are running different code* is a live state rather than a
build failure.

Three answers and three sentences, because **`null` and `false` are not the same
news**: agreeing, disagreeing, and not knowable. Only disagreement is an alert —
a page that showed the same thing for unknown and for disagreeing would be the
page that hid a half-finished deploy.

## Up and down are words

Not a colour alone. Three states told apart by hue is three states nobody
colour-blind can tell apart — the paragraph token's own rule, and it binds
hardest on the screen somebody reads while something is broken. The time is shown
for a failure too: how long it took to fail is the difference between *refused*
and *timed out*, and that is the first thing anybody wants to know.

## Two things a mutation found

**A test that could not fail.** "Gives every probe a deadline" asserted the
`AbortSignal` *inside* the `fetch` stub — and `probe` catches everything a probe
throws, so removing the timeout turned the assertion into a reading and the test
still passed. An assertion inside a callback the code under test wraps in `try`
is an assertion that cannot fail. The signal is now captured and asserted
outside.

**A condition that could not matter.** `sameCommit` read `!realtime.up || theirs
=== '' || …`, and deleting the first clause changed no answer: `commit` is only
ever set by a *successful* probe, so a service that is down has no commit and
the second clause already covers it. Removed — a condition that cannot change an
outcome is one a reader verifies for nothing. A mutation that adds a commit to
the *failure* path is what now guards the claim.

## Mutations that must go red

- A probe failure escaping instead of becoming a reading.
- The deadline removed.
- The socket service's answer not decoded.
- A failed probe reporting a commit.
- Unknown rendered as disagreeing.
- The state shown as a colour without a word.
