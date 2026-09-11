# Track J — SEO, legal, and the polish list

| | |
|---|---|
| **State** | 🔶 J.1 to J.7 — documents, arrivals, graphics, and links that resolve |
| **Branch** | `feat/seo-and-legal` |
| **Depends on** | track A (for anything drawn) |
| **Delivers** | the launch checklist, and only the parts that are missing |

## Objective

Work through the launch checklist — the SaaS-shaped list of privacy policy,
sitemap, meta tags, consent, performance — **as an audit first**. Half of it
is already done, and re-planning done work is how a checklist becomes busywork.

## The audit lives in its own sheet

Re-run on 2026-09-11 against the code at the tip of `staging`, and recorded in
`10-seo-audit.md` — nineteen rows, each one naming the file that delivers it and
the test that holds it.

**Do not re-read the version that used to sit here.** It was a snapshot of
2026-09-05, and three of its ✅ were already false: the share image had since
shipped, and the mobile and accessibility rows named a list of four routes while
tracks E to I added eight more. A snapshot in a plan file is how a checklist
starts lying, which is exactly what J.1 is for.

## The legal minimum, and why it is not optional

The plan that started this effort said, in substance, *let us not bother with
the GDPR, we ask for the strict minimum.* The minimum is the right instinct
and it does not remove the obligation:

- An email address is personal data. An account is processing. A European
  visitor has rights over both.
- **Advertising is what makes this expensive**, and it is deferred
  (`11-deferred.md`). An ad network in Europe requires a certified consent
  platform, a consent signal passed to the network, and a policy that names
  it. None of that is needed while there are no ads — which is the strongest
  practical argument for the deferral.

So the work here is genuinely small: a privacy policy naming what is stored
and for how long, terms, and the export and delete that track E already
builds. Analytics is chosen to keep it that way — see below.

## Analytics without a consent banner

**Prefer a cookieless, non-tracking analytics tool** — server-side or
aggregate, no cross-site identifier, no personal data leaving the EU. Under
that choice no consent banner is required, and the site keeps a first
impression that is a game rather than a dialog.

The alternative — a conventional analytics suite plus a consent banner — is
recorded as a fallback, not a default. **A cookie banner is a real cost paid
in every visitor's first three seconds**, and it should be paid for something
better than a page-view counter.

## Steps

| # | Step | State |
|---|---|---|
| J.1 | Re-run the audit, and record it | ✅ |
| J.2 | Favicon, app icons, web manifest | ✅ — `10-seo-icons.md` |
| J.3 | Privacy policy and terms, localised | 🔶 — `10-seo-legal.md`, awaiting an address |
| J.4 | Arrivals counted, first-party | ✅ — `10-seo-analytics.md` |
| J.4b | The panel section that shows them | ✅ — `10-seo-analytics.md` |
| J.5 | The FAQ, and the copy the landing needs | ✅ — `10-seo-faq.md` |
| J.6 | `alt` text pass across every image | ✅ |
| J.7 | Broken-link check, wired into CI | ✅ |
| J.8 | The performance budget, extended past the landing | ⬜ |
| J.9 | The indexing decision for the routes E to I added | ⬜ |
| J.10 | Phone width and reachability, over those same routes | ⬜ |
| J.11 | The export, over what F, G and H added | ⬜ |

**The sheets carry the arguments**, and the table above names them: a step whose
whole reasoning fits in a paragraph has no sheet and is argued in a section
below instead. Nothing is said in both places.

### J.8 — a budget that exists, over pages that have none

The landing already carries one and CI already fails on it: layouts that do not
scale with frames, the worst throttled frame under 250 ms, CLS under 0.1, total
blocking time under 200 ms. J.8 is to give the other routes a number, not to
invent the first one.

### J.9 and J.10 — what the audit found

`/leaderboard` is the only route added since the indexing contract that carries
no directive either way, and its own source defers that call to this track. It
is also the only one of the ten a guest is invited to read. J.10 is the 360 px
sweep, which names four routes while ten exist. Both are argued in
`10-seo-audit.md`.

### J.6 — one attribute, and the scan that keeps it true

The pass had almost nothing to audit, which J.1 had already found: **no `<img>`
and no `next/image` anywhere**, and two inline `<svg>`. One of them — the arrow
marking another player's cursor — carried neither `aria-hidden` nor a name, so a
screen reader announced a graphic that means nothing beside the name it
decorates. Hidden, because *where* is the whole of what an arrow says and a
position announced to somebody not looking at the screen is noise.

The rest of the step is `graphics.test.ts`: a source scan over **both**
`apps/web` and `packages/ui` — the two icons live one in each — refusing an
`<svg>` that is neither hidden nor named, and an `<img>` or `next/image` with no
`alt` at all, for the day there is one. It was checked by breaking the other
icon on purpose: the scan failed and named the file.

### J.11 — the export is older than three tracks

`exportAccount` was written in E.7 and still returns what existed then: the
account, the profile, the statistics, the games and the reports. **Coins, quest
assignments, hint purchases, item uses and leaderboard entries are not in the
file a player downloads**, which makes the right of access partly unimplemented.
Found while writing the policy, which is why the policy says what the file
actually holds.

### J.7 — In CI, or it will not be run

A link check run by hand is a link check run once. It goes in the pipeline,
against the built site, and it fails the build. Same for the performance
budget: a number in a document is a wish, a number in CI is a budget.

**Shipped as a browser journey rather than a workflow job**, and the three
reasons are worth keeping: `pnpm e2e` already runs on every pull request, a spec
fails the build exactly the way a job does, and a new job means editing
`.github/workflows/`, which the repository's token has no scope for. C.7's
performance budget made the same call.

It asserts two different things. **What the site publishes resolves** — every
`<loc>` in the sitemap, which is the one broken link a crawler is guaranteed to
find. And **what the site links resolves** — every internal `href` reachable
from the front door in two hops, in both languages, fetched and required not to
answer 400 or worse.

A crawl that finds nothing passes everything, so the pages it must have reached
are named: the three documents and the way in, in both locales. Checked by
pointing the footer's FAQ link at `/faqs`: the spec failed and said which path
had stopped being reachable.

**External links are checked for shape and never fetched.** Wikipedia and
creativecommons.org are somebody else's uptime, and a build that goes red
because a third party is slow is a build nobody trusts twice — which is how a
link check ends up disabled.

## Exit gate

- `10-seo-audit.md` has no ❌ that is not deliberately deferred, with a reason.
- Privacy and terms exist in both locales and say what is actually stored.
- No cookie banner, because nothing was installed that needs one.
- The link check and the performance budget run in CI and can fail it.
