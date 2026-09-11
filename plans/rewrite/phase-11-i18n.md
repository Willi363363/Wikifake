# Phase 11 — Internationalisation

| | |
|---|---|
| **State** | in progress — 11.1 done: `next-intl` chosen, wired, proven on the front door in both locales; 11.3 + 11.4 done: detection, the persistent switch, localised routing under `/fr`, no legacy URL 404s; 11.5 done: `lang` and the SEO metadata follow the locale, C6.3 amended with its tests; 11.6 done: the French catalogue, real translations held to the English keys by the build itself; 11.8 done: the 404 and error surfaces exist, and speak both locales |
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

The definitions and what each one found are in `phase-11-steps.md`; the two
decisions that outgrew a paragraph have their own sheets. **This table is the
only place that says where a step stands.**

| # | Step | State | Sheet |
|---|---|---|---|
| 11.1 | Choose the i18n library | ✅ | `phase-11-library-decision.md` |
| 11.2 | Extract every user-facing string | ✅ | — |
| 11.3 | Locale detection and explicit switch | ✅ | — |
| 11.4 | Localised routing | ✅ | — |
| 11.5 | `lang` attribute and per-locale SEO | ✅ | — |
| 11.6 | French catalogue | ✅ | — |
| 11.7 | CC BY-SA attribution in every locale | ✅ | — |
| 11.8 | The pages that do not exist yet speak no language | ✅ | — |
| 11.9 | The sentences the packages author | ✅ | `phase-11-refusals.md` |

## Exit gate

- Every user-facing string lives in a catalogue; both locales are complete —
  including the ones the packages author, which reach the player as a code
  (step 11.9).
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
