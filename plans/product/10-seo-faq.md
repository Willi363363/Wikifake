# Track J — the questions, and the copy that turned out to be there

The record of **J.5**. `10-seo-and-legal.md` keeps the step table — the only
place that says where a step stands.

## Eleven questions, answered from the code

Same discipline as J.3: every answer describes what this application does, not
what a game like it might. Where an answer would have needed a number — what a
found paragraph is worth, how long a round lasts — it points at the front page
instead, which reads those figures from the same rules the server grades with.
**A number written twice is a number that will disagree with itself**, and a FAQ
is the copy nobody thinks to update.

The order is a decision. `trust` is second, immediately after "what is this":
everything else on the page is how the game works, and that one is about not
believing what it shows you. A reader who leaves after two answers should have
read it. `document.tsx` holds the order and `legal.test.tsx` holds it to the
catalogue, so a question cannot be translated and then never shown.

## The second half of the step was already done

J.5 is "FAQ, **and the copy the landing needs**". Audited rather than assumed:
the landing says what the game is in four beats, credits Wikipedia, and ends on
a call to action that step C.5 deliberately put last — "a call to action that
arrives before the thing it concludes is one nobody has been given a reason
for".

There is nothing to add to it. The copy that was missing is exactly the copy
this page now carries: the questions those four beats do not answer. A link at
the end of the landing was considered and refused, because anything after the
call to action competes with it — and the footer already offers the FAQ from
every screen, including the round.

## The one piece of structured data on this site

`FaqStructuredData` emits a schema.org `FAQPage`, and this is the only page that
gets any. A FAQ genuinely *is* a list of questions and answers, which is a shape
search engines have read for years; marking up a game screen would be inventing
a claim about what it is.

**Built from the catalogue the page renders**, never a second copy — a
hand-written block of JSON-LD is a promise to keep two things in step for ever.
`faq-data.test.tsx` parses what is emitted, holds every question and answer in
it to the catalogue, and asserts the French page carries French data rather than
an English block under it.

It also escapes `<`. A translated answer containing one would close the script
tag and turn the rest of the page into text — a failure that renders as a broken
page, not as an error. The answers are written by hand, and the next hand is not
this one.

## Indexable, like the two beside it

`/faq` joins `/privacy` and `/terms` in `INDEXABLE_ROUTES` and therefore in the
sitemap, in both locales. The argument is the one J.3 made and this page makes
more strongly: the questions somebody types into a search engine about a game
are the questions on this page, and a page no crawler may keep answers none of
them.

## What it shares, and why that is not a mistake

The FAQ renders through `src/legal/document.tsx` and lives in the `legal` zone
of the catalogue. It is not a legal document, and it is the same *shape* — a
title, a date, an introduction, sections of a heading and a body. A second
renderer for that shape would be two files to fix the next time a document needs
a wider measure. The module's name is about the shape rather than the subject;
if a fourth document makes that read badly, renaming it is a step of its own and
not a reason to duplicate a component now.
