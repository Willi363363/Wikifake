# Phase 11 — Internationalisation

| | |
|---|---|
| **State** | in progress — 11.1 done: `next-intl` chosen, wired, proven on the front door in both locales; 11.3 + 11.4 done: detection, the persistent switch, localised routing under `/fr`, no legacy URL 404s; 11.5 done: `lang` and the SEO metadata follow the locale, C6.3 amended with its tests |
| **Branch** | `feat/rewrite-phase-11` |
| **Depends on** | phase 8 |
| **Delivers** | an interface in English and French: catalogues, switch, localised routing, per-locale SEO |

## Objective

Bring French back as a real locale. The whole product is being rewritten in
English — code, comments, commits, documentation and user interface — so the
interface ships English-only first. French is not abandoned: it returns here
as a proper second locale, with message catalogues, locale detection, an
explicit switch and localised routing — not as untranslated leftovers.

## Why now

Because the alternative is the current situation: a UI that mixes French and
English at random, with no framework at all. Internationalisation only makes
sense once every screen exists — hence the dependency on phase 8, which
completes the round — and once every string was written in English on purpose,
so that "translate" means filling a catalogue, not hunting stragglers.

One tension is worth stating plainly: the game reads `fr.wikipedia.org`, so
article content stays French whatever the interface language. An English
interface over French articles is a deliberate, visible mismatch. Supporting
`en.wikipedia.org` is a separate question — content sourcing, not interface
language — and this phase does not settle it.

## Steps

### 11.1 — Choose the i18n library

One library for the Next.js App Router, chosen and recorded with its reasons:
App Router support (server components included), typed message keys, locale
routing story. The choice is a decision of this step, not a given.

**Done when**: the library is installed, wired into the app, and one screen
renders through it in both locales as proof.

**Decided**: `next-intl` — the choice, its reasons, the alternatives and the
per-zone catalogue layout are in `phase-11-library-decision.md`. The proof
screen is the front door (`page.locale.test.tsx`, both locales).

### 11.2 — Extract every user-facing string

Every string a player can see moves into the English message catalogue:
screens, buttons, errors, toasts, item names and descriptions, empty states.
No literal user-facing string survives in a component.

**Done when**: a check over the frontend finds no hardcoded user-facing
string, and the app renders entirely from the catalogue.

### 11.3 — Locale detection and explicit switch

The locale comes from the request (`Accept-Language`) as a default, and from
an explicit language switch as the override. The player's choice persists and
always wins over detection.

**Done when**: a French browser lands on French, the switch changes the whole
interface at once, and the choice survives a reload.

### 11.4 — Localised routing

Each locale has its own routes, so a URL identifies a language. Existing
unprefixed URLs keep working — they redirect to the detected or chosen locale.

**Done when**: both locales are reachable by URL, and no legacy URL 404s.

### 11.5 — `lang` attribute and per-locale SEO

`lang` follows the interface locale, and the SEO metadata — titles,
descriptions, `hreflang` alternates — is emitted per locale. This interacts
with the compliance test that currently locks `lang="fr"`: that test changes
meaning here, from asserting one value to asserting the right value per
locale. It is amended in this step, with the contract file, never silenced.

**Done when**: each locale serves its own `lang` and metadata, and the
amended compliance test asserts both.

**Done**: `lang` comes from the `[locale]` segment; the metadata is
`generateMetadata` reading the catalogue's `seo` zone — title, description,
per-locale canonical, `hreflang` alternates, `og:locale` — and the sitemap
declares both locales. C6.3 was amended in
`02-contract-transport-and-compliance.md` together with its tests
(`language.test.ts`, `layout.test.tsx`, `indexing.spec.ts`), in the same
change as the behaviour.

### 11.6 — French catalogue

The English catalogue is translated to French — real translations, reviewed,
not machine output pasted blind. Terminology is consistent with what the
game's French players already know from the legacy UI.

**Done when**: the French catalogue has no missing key — the build fails on
one — and a French run of every screen shows no English.

### 11.7 — CC BY-SA attribution in every locale

The attribution — "text deliberately modified" + licence + link to the
source article — is legally required, during and after the round. It must be
correct in every locale: exact wording, licence name and link intact, no key
ever falling back to a missing translation.

**Done when**: the compliance tests assert the full attribution in each
locale, during and after the round.

## Exit gate

- Every user-facing string lives in a catalogue; both locales are complete.
- Detection, explicit switch and localised routing work; the choice persists.
- `lang` and SEO metadata follow the locale; the amended compliance test
  covers both values.
- The CC BY-SA attribution is correct and tested in every locale.
- The decision on the i18n library is recorded with its reasons.

## Invariants involved

The **compliance** guarantees of `01-contract-to-preserve.md` are the heart
of this phase: the CC BY-SA attribution must stay visible and correct during
and after the round in every locale, and the `lang="fr"` guarantee becomes
per-locale — its test is amended together with the contract file (step 11.5),
never weakened. **Server authority** is untouched: locale is presentation,
and no game rule may fork on it.

## Pitfalls

- **Article content is not interface text.** Titles, paragraphs and topics
  come from `fr.wikipedia.org` and stay French under an English interface.
  Do not translate them, do not mark them with the interface locale — they
  keep their own `lang`.
- **The `lang="fr"` test will fail mid-phase.** That is the test doing its
  job. Amend it with the contract, in the same PR as the behaviour change —
  never skip it to get CI green.
- **Attribution is law, not copy.** A missing key elsewhere shows a raw
  identifier; a missing key in the attribution is a licence violation. It
  gets its own tests per locale.
- **Concatenated fragments do not translate.** Sentences built from pieces,
  plurals done with `s`, word order assumptions — catalogue entries are
  whole messages with placeholders.
- **`en.wikipedia.org` is out of scope.** Interface language and article
  source are separate axes; do not couple them, do not sneak the second in.
