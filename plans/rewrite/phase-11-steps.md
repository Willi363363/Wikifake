# Phase 11 — the steps, and what each one found

The definitions of steps 11.1 to 11.9, and the record of what each turned up.
`phase-11-i18n.md` keeps the frame and the step table — the only place that says
where a step stands.

They moved here at 11.9, when the phase file reached the 200-line rule with a
step still to write. The method's own answer to that: the phase file keeps the
frame and the tables, satellite sheets carry the definitions.

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

**Done**: every zone's French file is a real translation, reviewed against
the legacy Vite frontend's vocabulary (salle, gel du temps, pillage, tournis,
le chrono). `catalogue.check.ts` holds every French zone to the English shape
at the type level, so a missing or extra key refuses to compile — `tsc` and
`next build` both fail, before any test runs. `catalogue.test.ts` further
refuses a French message that reads identically to its English counterpart
unless it is defended by name, which is what "no English on a French screen"
means at the catalogue's level; the per-screen French renders remain the
locale suites' (front door, attribution).

### 11.7 — CC BY-SA attribution in every locale

The attribution — "text deliberately modified" + licence + link to the
source article — is legally required, during and after the round. It must be
correct in every locale: exact wording, licence name and link intact, no key
ever falling back to a missing translation.

**Done when**: the compliance tests assert the full attribution in each
locale, during and after the round.

**Done**: `attribution.test.tsx` renders the round in every locale, during
and with the debrief up, and asserts the full attribution — exact wording
held in the test itself, licence name and both links intact, the topic link
kept `lang="fr"` — plus a catalogue guard that reads every locale directory
on disk and fails on any missing, empty or placeholder-stripped attribution
key. `renderIn` (per-locale render) joined `src/i18n/testing.tsx` for it.

### 11.8 — The pages that do not exist yet speak no language

`apps/web/app` has no `not-found.tsx` and no `error.tsx`, so an unknown URL or a
render error shows Next's built-in defaults: English words no catalogue reaches,
under a French interface, with none of the design system on them.

Step 11.2 moved the strings that existed. These pages have none because they do
not exist, which is why the extraction pass could not own them and why this is a
step of its own rather than a line in that one.

Three surfaces, and they are not the same surface:

- **`[locale]/not-found.tsx`** — a 404 inside a locale. Has the layout, the
  provider and the catalogue; reads its copy like any screen.
- **`[locale]/error.tsx`** — a render error inside a locale. A client component
  by Next's contract, with a `reset()`. The layout is still standing, so the
  catalogue is still reachable.
- **`global-error.tsx`** — the root layout itself failed. **It replaces `<html>`,
  so there is no provider and no messages**: it carries its own markup and its
  own words, and translating it is not possible rather than not done.

The unmatched-locale 404 belongs to the root, not to `[locale]`: a URL whose
first segment is not a locale never reaches the segment's layout.

**Done when**: an unknown URL and a thrown render error each show a WikiFake
page in the interface locale, in both locales, asserted by a test per surface;
and the French run shows no English on any of them.

**Done**, and the browser found what the unit tests could not. Rendering the
components proves the words; it does not prove Next reaches them. It does not:
the root `not-found.tsx` answers every unmatched URL, and a segment's own
`not-found.tsx` only answers a `notFound()` thrown *inside* it — so a typo never
entered the locale and a French player got the English root page, which is this
step's defect arriving through the back door. A catch-all
`[locale]/[...rest]/page.tsx` that calls `notFound()` is what makes the typo
match something inside the segment. `apps/e2e/specs/not-found.spec.ts` asserts
the status code as well as the words, in both locales: a 404 served with 200 is
a soft 404, indexed by a crawler and invisible to a monitor.

### 11.9 — The sentences the packages author

`@wikifake/protocol` and `apps/realtime` wrote player-visible English, and it
reached a French player unchanged. The answer is not a catalogue entry in
`apps/web`: **a package that authors a player-visible sentence emits a code the
client translates.** `phase-11-refusals.md` is the record.

**Done when**: every `ERROR_CODE` has a sentence in both catalogues, a test
holds the two lists to each other, a code from a newer server falls back to a
sentence rather than an identifier, and no screen prints a string the server
wrote.

**Done.**
