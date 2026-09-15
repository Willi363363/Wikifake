// The day's subject, chosen by Wikipedia — step N.2.
//
// **Nothing in this repository chose a topic before this.** `sourceArticle` takes
// one, and every caller had a player or a room to ask. The article of the day has
// nobody to ask, so this is the piece that was missing rather than a convenience
// over one that existed.
//
// **And it is not a model call.** The `topic_choice` kind in `llm_call` is
// inherited from the Python and no TypeScript caller produced it. Asking a model
// daily would be a call that costs money, can fail, and needs watching — the
// three things the owner's constraint refuses, and the constraint that shaped
// track F's rule catalogue. Wikipedia already knows what it is about.
//
// **The filter is the whole of the work.** A title is a candidate, not an
// article: `generateArticle` needs `MIN_ARTICLE_PARAGRAPHS` usable paragraphs,
// and a disambiguation page, a stub about a village and a list of episodes all
// fail that. So candidates are fetched and counted here, before anything is sent
// to a model — a rejection at this stage costs one Wikipedia request and nothing
// else.
import { MIN_ARTICLE_PARAGRAPHS } from './generate.js';
import {
  fetchRenderedPage,
  mostViewedTitles,
  randomTitles,
  type RenderedPage,
  type WikiRequest,
  type WikiTransport,
} from './mediawiki.js';
import { collectParagraphs } from './paragraphs.js';
import { failed, ok, type Result } from './result.js';

export interface ChooseDependencies {
  readonly wiki: WikiRequest;
  readonly transport: WikiTransport;
}

export interface ChooseOptions {
  /**
   * How many titles to ask each list for.
   *
   * Wide on purpose. Most-viewed answers across namespaces and the paragraph
   * filter throws more away, so asking for one candidate is asking for nothing
   * most days.
   */
  readonly candidates: number;
  /**
   * How many candidates to fetch before giving up.
   *
   * Separate from `candidates` because they bound different things: one bounds
   * the list, this bounds the **requests**. Without it a bad day would fetch
   * fifty pages to find nothing, at the moment somebody is waiting for a round.
   */
  readonly attempts: number;
}

export interface ChosenArticle {
  readonly page: RenderedPage;
  /** Where it came from. Recorded because a day of randoms is worth noticing. */
  readonly source: 'most_viewed' | 'random';
  /** Candidates fetched and rejected before this one. */
  readonly rejected: number;
}

/**
 * The first candidate with enough paragraphs to be worth playing.
 *
 * **The page comes back, not the title**, and that is deliberate: the caller is
 * about to falsify it, and handing back a title would mean fetching the same
 * page twice — once to find out it was usable and once to use it.
 */
async function firstUsable(
  titles: readonly string[],
  source: ChosenArticle['source'],
  dependencies: ChooseDependencies,
  attempts: number,
): Promise<ChosenArticle | null> {
  let rejected = 0;

  for (const title of titles.slice(0, attempts)) {
    const page = await fetchRenderedPage(
      title,
      dependencies.wiki,
      dependencies.transport,
    );
    // A candidate that will not load is a candidate, not an outage: the next one
    // is tried. A wiki that is really down fails every one of them, and the
    // caller sees `no_results` rather than a stack trace.
    if (!page.ok) {
      rejected += 1;
      continue;
    }

    if (collectParagraphs(page.value.html).paragraphs.length >= MIN_ARTICLE_PARAGRAPHS) {
      return { page: page.value, source, rejected };
    }

    rejected += 1;
  }

  return null;
}

/**
 * An article for the day: the most read first, a random one if that fails.
 *
 * The fallback is not a formality. `list=mostviewed` is an extension rather than
 * core MediaWiki, and a day's list can be all main pages and searches once the
 * namespace filter has run — so the caller that falls through must still get a
 * round rather than an error.
 */
export async function chooseDailyArticle(
  dependencies: ChooseDependencies,
  options: ChooseOptions,
): Promise<Result<ChosenArticle>> {
  const viewed = await mostViewedTitles(
    options.candidates,
    dependencies.wiki,
    dependencies.transport,
  );

  if (viewed.ok) {
    const chosen = await firstUsable(
      viewed.value,
      'most_viewed',
      dependencies,
      options.attempts,
    );
    if (chosen !== null) return ok(chosen);
  }

  const random = await randomTitles(
    options.candidates,
    dependencies.wiki,
    dependencies.transport,
  );
  if (!random.ok) return random;

  const chosen = await firstUsable(
    random.value,
    'random',
    dependencies,
    options.attempts,
  );

  return chosen === null
    ? failed('no_results', 'no candidate had enough usable paragraphs')
    : ok(chosen);
}
