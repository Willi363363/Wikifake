# Track C — the paths where the scene does not engage

The record of step C.6: the landing as it reaches somebody the scroll scene was
never going to run for. `03-landing.md` keeps the frame and the step table — the
only place that says where a step stands — `03-landing-scene.md` records how the
scene itself was built, and `03-landing-budget.md` what it costs to run.

Its own sheet because that one is full: 199 lines against a 200-line cap, and
`../method/00-dev-cycle.md` says a phase that outgrows its file splits into
satellite sheets rather than being squeezed into one. The cut is where the
subject changes anyway. C.1 to C.5 are about a camera and four beats; this one
is about what happens when there is no camera.

## C.6 — three switches, one document

Non-negotiable 2 of `03-landing.md`: with `prefers-reduced-motion`, the scene
resolves to "a static, correctly ordered document — headings, text, a call to
action. Not a frozen animation. Not a blank stage."

Step C.2 built three switches for that, and only one had ever been looked at:

| Switch | Where it lives | What checked it before C.6 |
|---|---|---|
| the preference | the media query | `landing.spec.ts` — the camera is not sticky |
| the width, below `md` | the same query | nothing |
| JavaScript | the `<noscript>` block | `stage.test.tsx` — the text of the block |

`apps/e2e/specs/landing-document.spec.ts` is the step: **one assertion asked of
all three paths**, and it is about the document rather than about the switch.
Every heading in order, both ways in, the extract, the sentence naming the
number that moved, the four scoreboard rows, the licence notice; nothing
transparent, nothing displaced, no beat `inert`, no sideways scroll. A path with
its own weaker version of that function would be a path nobody notices going
quiet.

## What it found: a revert that reverted the wrong half

**A browser with scripting off received beat 1 and three blank screens.**

The media query is *on* in that case — a wide viewport, no stated preference —
so every rule of the scene applies, and the `<noscript>` block is the only thing
between the visitor and four stacked screens that never advance. It reverted the
three declarations that make the stage a stage: the track's height, the camera's
stickiness, the beat's position. It reverted none of the ramps *inside* it.

Thirteen elements, measured, all at `opacity: 0`: the copy of beats 2 to 4, both
captions, both article headers, the tell, all four scoreboard rows and the
second call to action. Each one computes from `--beat-progress`, which the
server renders as −1, −2 and −3 — "you have not had your turn" — and with no
driver, nothing was ever going to give them one.

**`stage.test.tsx` passed throughout, and it is the more useful half of this.**
It asserted that the block contained `position: static !important`,
`height: auto !important` and `opacity: 1 !important`. All three were present.
All three were about the one element that was not the problem. A string match
against a stylesheet can only ever say what a rule *says*; three of them in a
row reads like coverage and is not.

## The repair is one line, and the reason it is one line

```css
.landing-stage__beat { --beat-progress: 0 !important; }
```

**The scene at rest is the document.** Every ramp in every one of the scene's
stylesheets is a `clamp()` around `--beat-progress`, and every one of them
resolves to its finished value at zero: the copy solid, the rows arrived, the
mark wiped, the depth vocabulary at no offset. Pinning the variable neutralises
the rules the block knows about and the ones a later beat adds.

An enumeration would have had to be extended by whoever wrote the next ramp, and
would not have been — which is exactly how the block came to be three
declarations short in the first place.

It needs `!important` for a second reason as well as the usual one: the value it
is beating is an **inline** custom property, and a normal declaration loses to
that. Author `!important` beats inline; that is the one place the rule earns
itself twice.

The rest of the block is layout, and layout does have to be enumerated: a flow
the scene took elements out of, and a grid it laid two of them on. Reverting
`.landing-article`'s three-row grid matters as much as the camera — a 9rem
header row is a heading that no longer fits in one, on a page nobody can scroll
away from.

## The two guards, and what each can see

- **`movement.test.ts`** reads the scene's stylesheets and holds the block to
  them: every rule that takes an element out of the flow (`position: absolute |
  sticky | fixed`) or replaces the flow inside it (`display: grid | flex`) must
  have its selector reverted, and the block must pin the variable every ramp is
  computed from. Two exclusions, both about what the flow contains:
  `position: relative` leaves an element where the flow put it, and a
  **pseudo-element** has no place in the document to be taken out of —
  `.landing-mark::before` is decoration inside a box rather than layout of one.
  A new `position: absolute` behind the media query now fails here.
- **`landing-document.spec.ts`** is the only thing that can see the *effect*. It
  runs with `javaScriptEnabled: false`, which is the state the failure needed
  and no unit environment has.

`stage.test.tsx` keeps one assertion and gives up the other three: the block
reaches the response, whole, inside a `<noscript>`. What it says is all that
test can see, and it now says so.

## Found on the way, not fixed here

**`margin-top: 0` on a stacked beat never applies.**
`landing-stage.css` sets it inside the media query, and the rhythm above it is
`.landing-stage__beat + .landing-stage__beat` — two classes against one, and a
media query adds no specificity. Measured in Chromium at 1280 wide:

```
beat 1   margin-top 0px    top 64
beat 2   margin-top 80px   top 192
beat 3   margin-top 80px   top 192
beat 4   margin-top 80px   top 192
```

Beats 2 to 4 agree with each other, which is why C.4's collision assertion — two
sheets on the same rectangle — never saw it. Beat 1 is the one that differs: its
content is centred in a box 80px taller, so the question sits about 40 pixels
above where every heading after it sits. Cosmetic, and real.

**It is filed in `../current-state/06-structural-debt.md`**, beside `border-l-3`
and `disabled:opacity-40` — the same family, a rule that reads correctly and
does nothing. It was written here first, when that register was at 190 lines
against the 200 cap and the handover was explicit that the next finding needed
the split rather than a squeeze; #180 did the split, so the entry went where it
belongs. The measurement stays here because this is the step that took it.

## A note for whoever runs the journeys

The three degraded paths cost nothing to run and are the ones nobody thinks to
open by hand. The failure above was invisible at every viewport, in both
palettes, in both locales, to anybody whose browser runs JavaScript — which is
everybody who has ever looked at this page.
