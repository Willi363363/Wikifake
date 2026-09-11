# Track J — the audit, re-run

The record of step J.1. `10-seo-and-legal.md` keeps the step table — the only
place that says where a step stands; this sheet says what the audit found and
what each row is held by.

## Method, and what it is worth

Read against the code at `2a03023`, 2026-09-11 — the tip of `staging`, after
track I. Every ✅ below names the file that delivers it **and** the test that
holds it; a row with no test is not a ✅, however finished the feature looks.

The snapshot it replaces was taken on 2026-09-05, before track C shipped its
share card and before tracks E to I added ten routes. That is the whole reason
J.1 exists as a step: three rows were ✅ against a list of routes that has since
doubled.

## The audit

| Item | State | Held by, or missing |
|---|---|---|
| `robots.txt` | ✅ | `app/robots.ts` → `src/indexing.ts`; `indexing.test.ts` |
| `sitemap.xml` | ✅ | `app/sitemap.ts`, `/` and `/play` per locale |
| Custom 404 | ✅ | `not-found.tsx`, localised; `not-found.spec.ts` |
| Error page | ✅ | `global-error.tsx`; `errors.locale.test.tsx`, `global-error.palette.test.ts` |
| Meta title and description | ✅ | `messages/<locale>/seo.json`; `[locale]/layout.test.tsx` |
| Canonical URLs and `hreflang` | ✅ | `[locale]/layout.tsx`; `indexing.spec.ts` |
| Social share image | ✅ | `[locale]/opengraph-image.tsx`, per locale — **was ❌**, C.8 shipped it |
| Mobile | ✅ | thirteen routes at 360 px, three of them behind an account — J.10 |
| Accessibility | ✅ | contrast audit, reduced motion, `fills.test.ts`, and the screens E to I added now reached and read — J.10 |
| Performance budget | ✅ | six entry screens, weight and CLS and blocking, in CI — J.8 |
| `alt` text pass | ✅ | nothing to label but two `<svg>`, and `graphics.test.ts` refuses the next unlabelled one — J.6 |
| Favicon and app icons | ✅ | `app/icon.tsx`, `app/apple-icon.tsx`; `icons.spec.ts` — J.2 |
| Web manifest | ✅ | `app/manifest.ts`; `manifest.test.ts`, `icons.spec.ts` — J.2 |
| Privacy policy | 🔶 | `app/[locale]/privacy`; `legal.test.tsx`, `legal.spec.ts` — the address is a placeholder |
| Terms | 🔶 | `app/[locale]/terms`; same tests, same placeholder |
| Cookie consent | ❌ | and still not needed — see below |
| Analytics | ✅ | first-party, no identifier — `page_view`, `POST /api/view`, and the panel's arrivals section |
| FAQ | ✅ | `app/[locale]/faq`, eleven questions and a `FAQPage` — J.5 |
| Broken-link check | ✅ | `links.spec.ts`, in the journeys CI already runs — J.7 |

**Four rows moved in the two days after the audit**, and they are ticked above
rather than left for a reader to reconcile: J.2 drew the icons and wrote the
manifest, J.3 wrote the two documents. `10-seo-icons.md` and `10-seo-legal.md`
record what each cost — including the step J.3 had to file against E.7's export.

## The three rows that changed state without anybody touching them

**Mobile.** `apps/e2e/specs/accessibility.spec.ts` sweeps `/`, `/play`, `/solo`
and `/gallery` at 360 px, plus the round reached by playing. Since that list was
written, tracks E to I added `/leaderboard`, `/quests`, `/shop`, `/profile`,
`/sign-in`, `/sign-up`, `/choose-a-name` and `/admin`. **None of them is
measured at phone width.** The sweep did not weaken; the application grew out of
it. Step **J.10**.

**Accessibility.** Same shape. The contrast audit is over the design system's
declared pairs and `fills.test.ts` over what the screens invent, so both still
cover the new screens by construction — those hold. What does not is any
assertion that a leaderboard, a shop or a quest list is reachable and readable;
that half of the row is now an inference. Folded into J.10 rather than given its
own step, because it is the same sweep over the same eight routes.

**Performance budget.** This row was ⬜ "no budget recorded" on 09-05 and is now
the strongest one on the list — for one page. `landing-performance.spec.ts`
asserts, in CI: layouts do not scale with frames, the worst frame under a
throttled CPU stays below 250 ms, CLS below 0.1 and total blocking time below
200 ms on a phone-shaped viewport. **No other route has a number**, and there is
no page-weight or Lighthouse baseline. J.8 is therefore "extend a budget that
exists", not "invent one" — which is a smaller step than the track file assumed,
and is what it turned out to be: six screens, a measured ceiling of 400kB, and
the measurement itself shared with C.7's spec.

## Cookie consent: the deferral holds, and here is the evidence

Three cookie sources, read rather than remembered:

- **the session cookie**, `better-auth` — strictly necessary, no consent;
- **the locale choice cookie**, `src/i18n/routing.ts` — written only when a
  player clicks the language switch, which is a preference they asked for;
- **Sentry**, `src/sentry.ts` — `@sentry/node`, initialised on the server, gated
  on `SENTRY_DSN`. There is no browser SDK in `apps/web/package.json`, so it
  sets nothing in anybody's browser. It does process an IP and a stack trace,
  which is J.3's business, not a banner's.

No third-party script, no advertising, no cross-site identifier. **The "no
banner" exit condition is currently true and J.4 is what could break it** — the
cookieless requirement is not a preference there, it is what keeps this row ❌
and correct at the same time.

## `alt` text: the pass is nearly empty, and has exactly one finding

There is no `<img>`, no `next/image` and no `<Image>` in `apps/web` or
`packages/ui`. The only raster image the site serves is the Open Graph card,
whose alt text Next fills from the file convention. Two inline `<svg>` exist:

- `packages/ui/src/primitives/dialog.tsx:79` — `aria-hidden focusable="false"`;
- `apps/web/src/round/player-cursors.tsx:59` — **neither**, so a screen reader
  announces a graphic that means nothing next to the name it decorates.

J.6 is therefore one attribute and a test that keeps the next `<svg>` honest.
**Both shipped**, and the scan reads `packages/ui` as well as `apps/web`,
because the two icons live one in each.

## What the audit added to the plan

Two steps, both of them findings rather than ideas:

- **J.9** — the indexing decision for the ten routes added after the contract
  was written. **Done**: the board is `noindex, follow` — it publishes
  pseudonyms, and a player chose a name other players would see rather than one
  a search engine keeps — and every decision moved into `UNINDEXED_ROUTES` in
  `src/indexing.ts`, where a test holds each screen to having one.
- **J.10** — the 360 px sweep, and a reachability assertion, over the eight
  routes tracks E to I added. **Done**: thirteen routes, three of them swept by
  an account because a stranger is redirected off them, and every one of them
  already fitted. `/admin` is deliberately not swept — `10-seo-sweep.md`.

Neither is scope the track invented: both are rows of its own audit table that
stopped being true while the table was not being read.
