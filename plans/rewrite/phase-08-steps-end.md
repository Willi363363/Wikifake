# Phase 8 — steps: how a round ends, and in what language

> Steps 8.7 to 8.10 — the debrief, flagging, the reference journey, and the
> interface in English. The phase sheet, its exit gate and where each step
> stands: `phase-08-frontend-round.md`. The article:
> `phase-08-steps-article.md`. During play: `phase-08-steps-play.md`.

### 8.7 — Debriefing

`Debrief` and `AnimatedRanking`. The statistics reveal is today a 5,400 ms
`setTimeout` tuned "by ear" to the roughly 5.1 s sequence of
`AnimatedRanking`: the sequencing becomes a single scheduler — the
animation signals its end, the debriefing follows. The solution (positions,
explanations) is only displayed from `game_end` onwards, and the CC BY-SA
attribution stays visible after the round.

**Done when**: slowing the animation down no longer desynchronises the
reveal, and the attribution assertion passes on the end screen.

Notes written when the step was done:

- **The debrief is a panel, not an overlay.** The current one is a fixed
  full-screen modal, which covers the article — and with it the CC BY-SA
  attribution C6.1 requires *after* the round as well as during it. Here it
  sits above the article, which keeps its verdicts and its attribution
  underneath. That is also what makes the "after" assertion possible at all.
- **The round is kept through the debrief.** `game_end` no longer returns the
  room to the lobby: the phase becomes `debrief`, and the player leaves it
  when they choose. The verdicts are drawn against the paragraphs *they*
  marked, and a screen that replaced this one would have thrown them away.
- **The verdicts come from `gradeAnswer`** — the same function the server
  graded with. Not for economy: a debrief that decided for itself which marks
  were right would be a second opinion on the score the player was given.
- **`SCORE_STEAL` is in the tally.** The current stage sequence has no place
  for it, so on any round where a rival cast it the animation ended on a
  different number from the score.
- **The solo score screen is gone**, replaced by this. `SoloScore` said "the
  full correction arrives in phase 8"; it has.

### 8.8 — Factual error flagging

`FlagButton`, `FlagCaptureModal`, `FlagReportForm`, `FlagToast`, wired to
`POST /api/flag-report` (phase 4), the model's verdict displayed.

**Done when**: a submitted flag appears in the database (`flag_report`) and
the toast reflects the verdict.

Notes written when the step was done:

- **The database half is step 4.9's.** `app/api/flag-report/route.test.ts`
  asserts every field of the report and of the verdict against a real
  database. This step's half is the verdict on screen, and the two closed
  unions being read exhaustively rather than printed: `verdict` and
  `recommendation` come out of a language model, and the current form shows
  whatever string arrived.
- **Two phases, kept.** Capturing takes one gesture during the round;
  writing the report up happens in the debrief. Asking for a correction and a
  source mid-round is asking for no reports at all, which is the current
  design's insight and worth keeping.
- **One report at a time.** The current form walks the captures with an index
  and a shared `currentForm`, so a field typed for one report is still in the
  box for the next.
- **`post` moved to `src/api.ts`.** The flag report is its second caller, and
  how a refusal is read — its sentence, its code, a body that is not JSON —
  is a decision rather than a detail.

### 8.9 — Multiplayer end to end

The reference Playwright test: four browsers in one room, theme voting,
round with items, debriefing. The negative assertions run during the round,
on every client.

**Done when**: the 4-player game plays end to end, items included, and the
negative assertions pass on all four clients.

Notes written when the step was done:

- **Four contexts, not four browsers.** Four isolated contexts are four
  players as far as the server can tell — four `sessionStorage`s, four
  session tokens — and they cost one browser launch. The pitfall list asks
  for a single short journey, and four engines would have been four times the
  wall clock for nothing.
- **It waits thirty seconds, once.** The first item wave is thirty seconds
  into the round, a rule carried over from `item_distribution_loop` so that a
  round opens item-free. There is no honest way to have items without waiting
  for them; everything else in the journey is as short as it can be.
- **Which item is dealt is a draw**, so the journey does not know whether the
  one it throws asks for a target. It reads the card's own accessible name —
  a card that needs one says so — and branches. That is the interface being
  legible enough to be driven, rather than the test knowing a secret.
- **Two lists in the debrief got names.** The ranking and the falsifications
  were both unnamed `<ol>`s inside one region, which a screen reader reads as
  one long run of items — and which made "four players are ranked"
  unassertable. Found by writing the assertion.

### 8.10 — English user interface

The user interface is now written in English: every player-facing string —
labels, buttons, notices, error messages — becomes English. The test that
locks `lang="fr"` in `frontend/src/__tests__/indexing.test.js` must be
updated accordingly, along with the SEO metadata. The CC BY-SA attribution
stays legally required, but is now written in English. Article content
itself stays French, because the game reads `fr.wikipedia.org`. French
comes back later through proper internationalisation — see
`phase-11-i18n.md`.

**Done when**: no French player-facing string remains on the round screens,
the updated `indexing.test.js` and the SEO metadata assertions pass, and
the English CC BY-SA attribution stays visible during and after the round.

Notes written when the step was done, and two are corrections:

- **There was almost nothing to translate.** Everything written since the
  rewrite began has been English, as `CLAUDE.md` requires — a scan of the
  whole application found exactly one French string, the SEO description.
  The step's value is therefore the scan itself, `src/language.test.ts`: a
  criterion checked once holds only until the next screen.
- **`indexing.test.js` is not touched.** It locks `lang="fr"` for the
  *legacy* frontend, whose interface is still French and correctly so. It is
  right as it stands, and it leaves with the Python at phase 10.
- **The document's own `lang` is step 11.5's**, not this one's. C6.3 is a
  clause of `02-contract-transport-and-compliance.md`, and 11.5 amends the
  clause and its test together when `lang` becomes per-locale. What this step
  does is the half that touches no contract: the article's title and body
  carry a `lang="fr"` of their own, because they come from
  `fr.wikipedia.org` and a screen reader should not read French prose in an
  English voice. Phase 11's pitfall list asks for exactly that.
