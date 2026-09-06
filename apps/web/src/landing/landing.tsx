// Step C.1 — the landing, as a document.
//
// Track C builds a fixed stage that the four beats of `03-landing.md` travel
// across as the page scrolls. This file is not that. It is what the stage will
// later present, and it comes first on purpose: non-negotiable 2 of that sheet
// says the reduced-motion path resolves to a static, correctly ordered
// document, and the only ordering under which that is cheap is the one where
// the document already exists and the scene is laid over it.
//
// So: headings are headings, the way in is a link, every sentence is a
// catalogue entry, and the page reads top to bottom with CSS disabled. Steps
// C.2 to C.5 add the camera; nothing below is expected to move to make room
// for it, and a beat that cannot be told without motion is a beat this file
// got wrong.
//
// The two paragraphs are the demonstration and they are `excerpt.ts`'s — real
// text, one rewritten number, and the CC BY-SA obligation that comes with
// quoting Wikipedia at all. `<Attribution>` is the round's own, because the
// obligation is the same one and a second wording of a licence notice is the
// one that goes stale.
import { buttonVariants } from '@wikifake/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Attribution } from '../round/attribution.js';
import { ArticleBeat } from './article-beat.js';
import { Stage } from './stage.js';
import { EXCERPT, TRUE_PARAGRAPH } from './excerpt.js';
import { Scoreboard } from './scoreboard.js';

/** The call to action, twice: once above the fold, once under the scoreboard. */
function WayIn({ label }: { readonly label: string }) {
  // A link, styled as the primary button. The front door navigates, and a
  // button that navigates is one a keyboard cannot open in a new tab.
  return (
    <Link href="/play" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
      {label}
    </Link>
  );
}

export function Landing() {
  const t = useTranslations('home');

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      {/* Four children, four beats. `Stage` is a camera the browser holds still
          at `md` and up when nobody asked for less motion, and nothing at all
          otherwise — which is how this stays the document it was in C.1. */}
      <Stage>
        {/* Beat 1 — the title, and the question.

            Step C.3: the question travels further than everything around it and
            the brand line travels less, so the beat arrives in three depths
            rather than as one slab. `landing.css` carries the arithmetic; the
            classes here say which layer a thing is on and nothing else. */}
        <section aria-labelledby="landing-question">
          <p className="landing-move landing-move--back text-sm font-semibold tracking-widest uppercase text-muted">
            {t('title')}
          </p>
          <h1
            id="landing-question"
            className="landing-move landing-move--fore mt-2 text-5xl text-ink sm:text-6xl"
          >
            {t('question')}
          </h1>
          <p className="mt-5 max-w-[60ch] text-base text-ink-2">{t('description')}</p>
          <div className="mt-8">
            <WayIn label={t('play')} />
          </div>
          <p className="mt-3 text-sm text-muted">{t('noAccount')}</p>
        </section>

        {/* Beats 2 and 3 — the same paragraph twice, and the whole
            demonstration. `ArticleBeat` renders both, so the false one lands on
            exactly the rectangle the true one occupied: that alignment is the
            collision, and two hand-written sections would drift apart the first
            time somebody added a line to one of them. */}
        <ArticleBeat
          headingId="landing-source"
          title={t('beats.source.title')}
          body={t('beats.source.body')}
          paragraph={TRUE_PARAGRAPH}
          caption={t.rich('beats.source.caption', {
            topic: EXCERPT.topic,
            source: (chunks) => (
              // The link is the title, not the sentence: a whole caption
              // underlined reads as a caption nobody wrote on purpose. It points
              // at the *revision*, where `<Attribution>` below points at the
              // article — one says what was quoted, the other credits it.
              <a
                lang="fr"
                className="underline hover:text-ink"
                href={EXCERPT.revisionUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                {chunks}
              </a>
            ),
          })}
        />

        <ArticleBeat
          over
          headingId="landing-collision"
          title={t('beats.collision.title')}
          body={t('beats.collision.body')}
          paragraph={
            <>
              {EXCERPT.before}
              {/* The wash carries `ink`, never the fill: `bg-green` here would be
                  the one hard colour rule broken on the first screen a visitor
                  sees. Green is the debrief's "found", so the colour is taught
                  here and recognised there — and on the stage it is wiped in
                  rather than simply present, which is `landing-mark`. */}
              <mark className="landing-mark bg-green-soft text-ink">{EXCERPT.claim}</mark>
              {EXCERPT.after}
            </>
          }
          caption={t('beats.collision.caption')}
          // The tell, in the reader's own language — which is what lets a
          // visitor who reads no French see what the demonstration is. It is
          // also why beat 2 reserves this row: without it the two sheets sit at
          // different heights and nothing collides.
          tail={t('beats.collision.tell', {
            truth: EXCERPT.truth,
            claim: EXCERPT.claim,
          })}
        />

        {/* Beat 4 — the scoreboard, and the way in under it. */}
        <section aria-labelledby="landing-score">
          <h2
            id="landing-score"
            className="landing-move landing-move--fore text-3xl text-ink"
          >
            {t('beats.score.title')}
          </h2>
          <p className="mt-3 max-w-[60ch] text-base text-ink-2">
            {t('beats.score.body')}
          </p>
          <Scoreboard />
          {/* Step C.5: last of all. A call to action that arrives before the
              thing it concludes is one nobody has been given a reason for. */}
          <div className="landing-way-in mt-8">
            <WayIn label={t('play')} />
          </div>
        </section>
      </Stage>

      {/* Outside the stage, and after it: a licence notice that only a viewer
          who reached the last beat could see would be a licence notice nobody
          reads. Required, not decoration: this page quotes Wikipedia and shows a
          modified version of what it quoted. Both halves of C6.1's obligation
          apply here exactly as they do beside the article in a round.
          It is also the *only* licence notice on the page — the front door used
          to carry a softer sentence of its own, and two wordings of one legal
          statement is the pair that drifts. */}
      <Attribution topic={EXCERPT.topic} sourceUrl={EXCERPT.sourceUrl} />
    </main>
  );
}
