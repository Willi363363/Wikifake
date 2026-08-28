# Phase 11 — the i18n library, decided

> Step 11.1's decision, recorded with its reasons, plus the catalogue layout
> that decision establishes. The step states live in `phase-11-i18n.md`.

## The decision

**`next-intl` 4.x** (installed: 4.14.0), wired through its App Router
integration: `createNextIntlPlugin` in `next.config.ts`, a request
configuration in `apps/web/src/i18n/request.ts`, and `NextIntlClientProvider`
in the root layout.

## Judged on the three criteria

The sheet names three criteria; they were the grid, in order.

**App Router support, server components included.** `next-intl` is built for
the App Router first: `useTranslations` works inside a server component with
no provider — it resolves against the request configuration through the
`react-server` export — and the same call works in a client component through
the provider. The proof is in the build: `/` stays a statically prerendered
server component and its HTML carries the catalogue copy. The peer range
declares Next 16, which this app runs.

**Typed message keys.** One `AppConfig` augmentation
(`src/i18n/next-intl.d.ts`) derives the key space from the English catalogue:
`useTranslations('home')` refuses a namespace that does not exist, `t('ttile')`
is a compile error, and dynamic keys still check — `t(`steps.${step}.title`)`
compiles only because `step` is a union of the keys that are really there.

**Locale routing story.** Built in rather than assembled: a `[locale]`
segment, middleware that negotiates from `Accept-Language` with a cookie
override, localised pathnames, `hreflang` alternates, and redirects for
unprefixed URLs — which is steps 11.3, 11.4 and 11.5 described feature by
feature. Step 11.1 deliberately wires none of it: the request configuration
answers a fixed `en` until 11.3 replaces that single line.

Beyond the grid, messages are ICU MessageFormat: whole sentences with
placeholders and real plural rules, which is the pitfall list's "concatenated
fragments do not translate" enforced by the format itself.

## The alternatives, and why not

- **`next-i18next`** — the Pages Router integration of `react-i18next`; its
  own README says to use `i18next` directly or another library on the App
  Router. Wrong architecture for this app.
- **`react-i18next` / `i18next` directly** — client-first: server components
  need hand-rolled instance plumbing, and there is no routing story. Both
  would be built here, badly, as one-offs.
- **FormatJS (`react-intl`)** — solid ICU core but provider-bound, so server
  components are second class; no routing; typed keys need extraction tooling.
- **Lingui** — good tooling, but macros add a compile step to every component
  and the App Router integration is younger; routing is still assembled by hand.
- **Paraglide JS** — compiled catalogues with real types, but a different
  authoring model (its own project format), a younger Next integration, and a
  smaller ecosystem to lean on when Next 16 shifts something.

## The catalogue layout

One JSON file **per zone and per locale** — `apps/web/messages/<locale>/<zone>.json`
— never one file per locale. Steps of this phase migrate zones in parallel
(lobby, round, waiting, chat…), and two branches rewriting one `en.json` is a
merge conflict by design; two branches each adding their own `<zone>.json`
merge clean.

- `src/i18n/catalogue.ts` declares `ZONES` and nests each file under its zone
  name as a namespace: a component reads `useTranslations('home')`, never a
  bare key. Adding a zone is one entry in `ZONES` plus one file per locale —
  the only line two parallel steps both touch.
- **English is the reference.** The typed keys derive from
  `messages/en/<zone>.json`; `src/i18n/catalogue.test.ts` holds every other
  locale to exactly the English key set, per zone, and refuses empty messages
  and undeclared files.
- **Entries are whole messages** with ICU placeholders — never fragments to
  concatenate, never plurals made with a trailing `s`.
- Article content never enters a catalogue: titles, paragraphs and topics come
  from `fr.wikipedia.org` and are data, not interface copy.

Planned zones as the phase proceeds: `home` (done, the proof screen), then per
step 11.2's migration: `lobby`, `waiting`, `round`, `solo`, `chat`, `gallery`,
`common` — and `attribution` on its own, because step 11.7 gives the CC BY-SA
attribution its own per-locale tests.

## What later steps replace

- 11.3: the fixed `DEFAULT_LOCALE` answer in `src/i18n/request.ts` becomes
  negotiation (`Accept-Language`) plus the player's persisted choice.
- 11.4: `next-intl`'s routing (`defineRouting`, middleware, `[locale]`
  segment), with unprefixed URLs redirecting.
- 11.5: `lang` and the metadata become per-locale; the duplicated English
  description (`messages/en/home.json` vs `src/indexing.ts`, pinned together
  by `page.locale.test.tsx`) collapses back to one source.

## A side decision the install forced

`next-intl` brings `@parcel/watcher` and `@swc/core`, both with install
scripts. Refused in `pnpm-workspace.yaml` (`allowBuilds: false`): each ships
prebuilt binaries as platform-specific optional dependencies, so the script is
only a node-gyp fallback — and the policy is that every build script is an
explicit exception.
