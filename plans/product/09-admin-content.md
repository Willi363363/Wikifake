# Track I — content and cache

The record of **I.7**, the last section. `09-admin.md` keeps the frame and the
step table; I.1 to I.6 are in the sheets beside this one.

## I.7 — content and cache  ✅

**Done when** the panel says which articles are drawn, how often the cache
answers, and how often generation does not.

## The cache hit rate explains the section above it

**A cached round costs nothing to generate**, so this rate is what stands
between a hundred rounds and a hundred generations — which makes it the figure
that decides I.6's spend rather than merely accompanying it. It leads the
section for that reason, and says so on the screen.

`shareOf` again: **null when no round has been played**, because no games is not
a hit rate of nought.

## A topic's plays and its cache hits, side by side

The two columns together are the point. **A topic played forty times and cached
thirty-nine is the cache working; the same topic cached twice is a cache that is
not holding what people ask for** — and the totals alone cannot tell those
apart.

The list is fifteen topics and the count of *distinct* articles sits beside it,
so the list reads as the sample it is rather than as a census. The order is
total — plays, then the title — so two reads return the same list.

Article titles are marked `lang="fr"`. The game reads `fr.wikipedia.org`, so
they are data rather than interface text, and a screen reader saying them in an
English voice is what the attribute prevents. The same decision `article.tsx`
made about the paragraphs.

## The two failures are kept apart, because they are not the same news

**A topic choice that comes back empty is somebody typing a word Wikipedia has
no article for.** It is ordinary, and the screen says so in as many words.

**A falsification that fails is a round a player waited for and did not get.**
That is the rate in the headline figure.

Folding them into one number would average an outage into a typo. And
`flag_verification` is deliberately excluded: it is not on the path to a round,
I.6's by-kind table already shows it, and counting it here would make the
verification of a player's report look like a generation failure.

## A retry is one game and two calls, and both are true

A round generated after a first attempt failed counts once as a generated game
and twice in the failure rate. There is nothing to reconcile — the round exists,
and the model was asked twice — and a test says so, because the instinct is to
treat one of the two as wrong.

## The placeholder list is gone, and so are its strings

The panel listed its unbuilt sections so a first visitor could see what it was
for. All six exist now, so the list and the `sections` and `answers` catalogue
entries that fed it are deleted rather than left behind: **a dead catalogue key
is dead code with a translation.**

## Mutations that must go red

- The cache rate counting only generated games.
- The topic list losing its cache column.
- The topic tie-break dropped, so two reads can disagree.
- `flag_verification` counted as a generation failure.
- The two failure kinds folded into one.
- An article title losing its language.
