# Track J — SEO, legal, and the polish list

| | |
|---|---|
| **State** | ⬜ not started |
| **Branch** | `feat/seo-and-legal` |
| **Depends on** | track A (for anything drawn) |
| **Delivers** | the launch checklist, and only the parts that are missing |

## Objective

Work through the launch checklist — the SaaS-shaped list of privacy policy,
sitemap, meta tags, consent, performance — **as an audit first**. Half of it
is already done, and re-planning done work is how a checklist becomes busywork.

## Audited against the code, 2026-09-05

| Item | State |
|---|---|
| `robots.txt` | ✅ `apps/web/app/robots.ts`, generated |
| `sitemap.xml` | ✅ `apps/web/app/sitemap.ts`, from `src/indexing.ts` |
| Custom 404 | ✅ `not-found.tsx`, localised — step 11.8 |
| Error page | ✅ `global-error.tsx`, localised — step 11.8 |
| Meta title and description | ✅ per locale, `[locale]/layout.tsx` |
| Canonical URLs and `hreflang` | ✅ `src/indexing.ts`, held by a test |
| Mobile | ✅ phase 6 step 6.5, and re-checked by tracks C and D |
| Accessibility | ✅ contrast audit + two browser journeys (#153) |
| Favicon and app icons | ❌ absent |
| Web manifest | ❌ absent |
| Social share image | ❌ absent — track C step C.8 |
| Privacy policy | ❌ absent |
| Terms | ❌ absent |
| Cookie consent | ❌ absent |
| Analytics | ❌ none installed |
| FAQ | ❌ absent |
| `alt` text pass | ⬜ never audited as a pass |
| Broken-link check | ⬜ never run |
| Performance budget | ⬜ no budget recorded |

**This table is a snapshot and will go stale.** Re-run the audit at the start
of the track rather than trusting these rows.

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
| J.1 | Re-run the audit above | ⬜ |
| J.2 | Favicon, app icons, web manifest | ⬜ |
| J.3 | Privacy policy and terms, localised | ⬜ |
| J.4 | Cookieless analytics | ⬜ |
| J.5 | FAQ, and the copy the landing needs | ⬜ |
| J.6 | `alt` text pass across every image | ⬜ |
| J.7 | Broken-link check, wired into CI | ⬜ |
| J.8 | Performance budget, recorded and enforced | ⬜ |

### J.7 — In CI, or it will not be run

A link check run by hand is a link check run once. It goes in the pipeline,
against the built site, and it fails the build. Same for the performance
budget: a number in a document is a wish, a number in CI is a budget.

## Exit gate

- The audit table has no ❌ that is not deliberately deferred, with a reason.
- Privacy and terms exist in both locales and say what is actually stored.
- No cookie banner, because nothing was installed that needs one.
- The link check and the performance budget run in CI and can fail it.
