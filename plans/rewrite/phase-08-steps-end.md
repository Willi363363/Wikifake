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

### 8.8 — Factual error flagging

`FlagButton`, `FlagCaptureModal`, `FlagReportForm`, `FlagToast`, wired to
`POST /api/flag-report` (phase 4), the model's verdict displayed.

**Done when**: a submitted flag appears in the database (`flag_report`) and
the toast reflects the verdict.

### 8.9 — Multiplayer end to end

The reference Playwright test: four browsers in one room, theme voting,
round with items, debriefing. The negative assertions run during the round,
on every client.

**Done when**: the 4-player game plays end to end, items included, and the
negative assertions pass on all four clients.

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
