# Track J — counting arrivals, without counting people

The record of **J.4** and **J.4b**. `10-seo-and-legal.md` keeps the step table —
the only place that says where a step stands.

## The question, and why nothing already answered it

Track I's panel answers everything downstream of the moment somebody pressed
play: accounts created, activation, return, rounds, abandon rate, model cost.
Every one of those is a row somebody's play created.

**Nobody who arrives and leaves creates a row.** So the one number the effort's
own definition of done depends on — *does a first-time visitor understand the
game before they scroll* — had no measurement at all. That is the whole of J.4:
how many arrive, and how many get as far as the screen with the topic field.

## What was chosen, and what was turned down

The owner picked a first-party counter over the three alternatives, and the
alternatives are worth recording because each will be proposed again:

| Option | Why not |
|---|---|
| Vercel Web Analytics | One line, cookieless, free — and a US processor to name in a policy written two days earlier, against this track's own "no personal data leaving the EU". |
| Plausible Cloud | Cookieless and in the EU, and €9 a month for a page-view count on a game with no revenue. |
| Umami, self-hosted | Free, and a fifth service to run, patch and watch fall over. |
| Nothing, deliberately deferred | Defensible, and it leaves the effort's first condition of done unmeasured for ever. |

## The shape is the privacy decision

**One row per day per page. No row per visitor, and no identifier anywhere** —
not a cookie, not a hashed IP, not a client-side id. `page_view` holds a date, a
page name from a closed list, and a number.

Three consequences, all of them accepted on purpose:

- **It counts loads, not people.** Two loads from one reader and one load from
  each of two readers are the same number here, and no amount of later analysis
  can separate them. A bounce rate is therefore not available and will not be
  without adding the identifier this deliberately does not have.
- **It cannot be inflated by accident, and can be by hand.** The route checks
  that the request's `Origin` matches the host it arrived at, which keeps out
  crawlers, stray `curl`s and other people's pages. A forged header passes.
  **This is not audit-grade traffic data**, and nothing should be spent on the
  strength of it.
- **There is nothing to export or erase.** The counter cannot be joined to a
  person, so it never appears in an access request, and deleting an account
  leaves it untouched because it never held anything about that account.

## The two things the route refuses

**A path.** The obvious field is the URL, and it is the one thing this must
never take: `/room/ABCD` and `/solo?topic=…` carry a room code and a subject
somebody typed. A counter keyed by free text stores whatever a caller sends it,
for ever. The request carries a value from a two-item enum in the protocol, and
`record.test.ts` holds that a path is refused.

**A locale.** Knowing whether arrivals read French or English would be
interesting. The locale list lives in `apps/web`, and a second copy in the
protocol is the duplication `CLAUDE.md` forbids — for a column nothing has asked
a question about yet. One page, whichever language it was read in.

## Why a beacon, and why it is a client component

The landing is prerendered, which is what C.7's performance budget measures. No
server code runs when somebody visits it, so **counting an arrival server-side
would mean making the page dynamic — trading the thing being measured for the
measurement**.

`navigator.sendBeacon` rather than `fetch`: the browser hands it to the network
stack and stops caring, so it survives the reader navigating away immediately —
which is exactly the visit most worth counting — and it cannot delay anything on
screen. The payload is a `Blob` typed `application/json`, because a bare string
is sent as `text/plain` and the route would refuse to parse its own request.

**Chromium does not expose a beacon's blob body to the debugging protocol**, so
`postDataJSON()` is null in a Playwright test however correct the request is.
The payload is asserted in `page-view.test.tsx` against a stubbed `navigator`;
the browser journey asserts what a browser can prove — that the request is fired
and comes back `counted: true`, which is only ever the answer to a body the
route could parse.

## What it cost elsewhere

**The privacy policy said "no analytics", and that stopped being true.** It is
updated in the same pull request, as the rule about documentation requires: the
technical-data section describes the counter and states that it holds no
identifier, and the cookie section now says no *third-party* analytics rather
than none. A policy that goes stale in the release that contradicts it is worse
than one that was never written.

## J.4b — the section, and the three sentences it refuses to leave out

A seventh section in the admin panel, between the rounds and what they cost:
the one place in it about people who are not players yet.

**The headline is the ratio**, not the totals. A landing that doubles its
arrivals and keeps its reach did well; one that doubles them and halves its
reach found the wrong audience. The two counts sit underneath, because a
percentage of an unknown is not a figure.

Three things a traffic panel is normally silent about are said on the screen,
and each is a conclusion a reader would otherwise draw that the number does not
support:

- **an em dash rather than 0%** when nothing arrived. A reach of zero says the
  landing failed; nobody arrived says nothing about the landing at all, and
  printing 0% for it is the panel inventing a finding;
- **the day counting began.** A ninety-day range covers weeks nobody was
  counting, so two ranges that straddle that date are not comparable. `since` is
  read over all time rather than over the range — asking inside the window would
  answer "the first day of the range", which is not a fact about anything;
- **these are loads, not people** — the same claim the privacy policy makes,
  from the other side.

**Reach can pass 100%, and that is not a defect**: the entry screen is reachable
from a bookmark without the landing, so a ratio above one says the front door is
not where players come in. A test asserts it rather than a clamp hiding it.

Two smaller decisions. The day is printed as the stored `YYYY-MM-DD` and never
formatted — the column is a UTC day, and a locale format renders it in the
reader's zone, moving a figure to the day before for anybody west of Greenwich.
And the table shows fourteen days with the rest counted in a line underneath: a
fortnight is what somebody who posted a link on Monday is looking for, and
ninety rows is a wall nobody reads.

The read also grew a case the counter did not have: the window ends at a clock
reading rather than at midnight, so **the day in progress has to be included**.
A read that dropped it would show a panel permanently one day behind — the
failure nobody notices, because yesterday's figures look right.
