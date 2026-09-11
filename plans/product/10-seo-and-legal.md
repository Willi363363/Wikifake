# Track J — SEO, legal, and the polish list

| | |
|---|---|
| **State** | 🔶 J.1 and J.2 done — the audit re-run, and the icons drawn |
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
| J.3 | Privacy policy and terms, localised | ⬜ |
| J.4 | Cookieless analytics | ⬜ |
| J.5 | FAQ, and the copy the landing needs | ⬜ |
| J.6 | `alt` text pass across every image | ⬜ |
| J.7 | Broken-link check, wired into CI | ⬜ |
| J.8 | The performance budget, extended past the landing | ⬜ |
| J.9 | The indexing decision for the routes E to I added | ⬜ |
| J.10 | Phone width and reachability, over those same routes | ⬜ |

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

### J.2 — the mark is a question mark, and not a letter

A yellow "W" is Wikipedia's own favicon, and this game reads their encyclopaedia
without being endorsed by them — C.8 refused the globe for the same reason. The
landing's first line is "Who is lying?", so the question is the game. The
drawing, the colour rule it must obey, and the defect a browser test found in it
are in `10-seo-icons.md`.

### J.7 — In CI, or it will not be run

A link check run by hand is a link check run once. It goes in the pipeline,
against the built site, and it fails the build. Same for the performance
budget: a number in a document is a wish, a number in CI is a budget.

## Exit gate

- `10-seo-audit.md` has no ❌ that is not deliberately deferred, with a reason.
- Privacy and terms exist in both locales and say what is actually stored.
- No cookie banner, because nothing was installed that needs one.
- The link check and the performance budget run in CI and can fail it.
