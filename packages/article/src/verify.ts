// D12 — fact-checking a player's report, and paying for it visibly.
//
// A player can flag what they believe is a **genuine** error in an article, as
// opposed to the ones the game injected. `flag_verifier.py` asks the model about
// it and records nothing: the call is invisible to `/api/usage`, so the endpoint
// under-reports the spend by however many reports came in. Here it produces an
// `LlmCallRecord` like every other call, on both paths.
//
// D13 is the other half. `flag_verifier.py` never sets the library's language or
// user agent, so on a freshly restarted process — before any game has been
// generated — it fact-checks a French article against the **English** Wikipedia.
// Here the language is a parameter, and the type will not let a caller omit it.
//
// It lives in this package rather than in the application because it needs
// exactly what this package owns: a MediaWiki client with nothing implicit, and
// a model call validated by a schema. An application holding a French prompt and
// a `generateText` call would be a second place doing what phase 3 exists to do.
import { flagsApi, type LlmCallRecord } from '@wikifake/protocol';
import { generateText, Output, type LanguageModel } from 'ai';

import { callFailed, callSucceeded, type CallShape } from './accounting.js';
import {
  fetchRenderedPage,
  searchTitles,
  type WikiRequest,
  type WikiTransport,
} from './mediawiki.js';
import { collectParagraphs } from './paragraphs.js';

/** How much of the article to put in front of the model, as `content[:3000]`. */
export const CONTEXT_CHARS = 3000;

export interface VerifyOptions {
  readonly model: LanguageModel;
  readonly articleTitle: string;
  readonly flaggedClaim: string;
  readonly proposedCorrection: string;
  readonly explanation?: string;
  readonly sources?: readonly string[];
  readonly wiki: WikiRequest;
  readonly transport: WikiTransport;
  readonly maxOutputTokens?: number;
}

export interface VerifyReport {
  /** Null when the model was never called: nothing spent, nothing recorded. */
  readonly call: LlmCallRecord | null;
  /** Always a verdict: a report that could not be checked is still a report. */
  readonly verification: flagsApi.FlagVerification;
  /** Whether Wikipedia could be read at all. Useful when triaging by hand. */
  readonly contextFound: boolean;
}

/**
 * The verdict a failed check produces.
 *
 * Never an exception. A player pressed a button, and the report has to be
 * recorded whatever the model or Wikipedia did — losing it because a third party
 * was unreachable is losing the only signal the game has about its own articles.
 */
const UNCHECKED: flagsApi.FlagVerification = {
  verdict: 'uncertain',
  confidence: 0,
  reasoning: 'Automatic verification failed. A manual review is required.',
  sourcesFound: [],
  recommendation: 'needs_more_info',
};

/**
 * The article's prose, capped, as `content[:3000]` already does.
 *
 * Read through `collectParagraphs`, so the model sees exactly the paragraphs a
 * player sees — normalised, deduplicated, short ones dropped. Feeding it raw HTML
 * would spend most of the budget on markup.
 */
function prose(html: string): string {
  return collectParagraphs(html).paragraphs.join('\n\n').slice(0, CONTEXT_CHARS);
}

/**
 * The article as reference material, or an empty string.
 *
 * The exact title first, then a search — the fallback `flag_verifier.py` already
 * has. `fetchRenderedPage` does not auto-suggest, so the fallback is a search we
 * asked for rather than a near match the library picked silently.
 */
async function context(options: VerifyOptions): Promise<string> {
  const direct = await fetchRenderedPage(
    options.articleTitle,
    options.wiki,
    options.transport,
  );
  if (direct.ok) return prose(direct.value.html);

  const titles = await searchTitles(
    options.articleTitle === '' ? options.flaggedClaim : options.articleTitle,
    options.wiki,
    options.transport,
  );
  if (!titles.ok) return '';

  const [best] = titles.value;
  if (best === undefined) return '';

  const found = await fetchRenderedPage(best, options.wiki, options.transport);
  return found.ok ? prose(found.value.html) : '';
}

/**
 * The prompt actually in use, carried over.
 *
 * In French, like the falsification prompt and for the same reason: the model
 * reads French Wikipedia and answers about French text. What changed is the last
 * paragraph — the current one asks for "UNIQUEMENT un objet JSON valide" and
 * then strips Markdown fences by hand. The schema does that now, so the
 * instruction is gone rather than merely unenforced.
 */
const SYSTEM = `
Tu es un fact-checker expert. Un joueur du jeu WikiFake a signalé ce qu'il pense être une vraie
erreur factuelle dans un article généré (distinct des fausses informations délibérément injectées
par le jeu).

Ton rôle :
1. Analyser l'affirmation signalée et la correction proposée par le joueur.
2. Utiliser le contexte Wikipedia fourni comme référence factuelle principale.
3. Évaluer si la correction proposée semble valide, incertaine ou non étayée.
4. Produire un verdict structuré.

Le raisonnement fait deux à trois phrases, en français. Les extraits retenus viennent du contexte
Wikipedia fourni, et il y en a au plus trois.
`.trim();

function userPrompt(options: VerifyOptions, wikiContext: string): string {
  const sources = options.sources ?? [];
  return [
    `Titre de l'article : ${options.articleTitle}`,
    '',
    'Affirmation signalée comme potentiellement fausse :',
    `"${options.flaggedClaim}"`,
    '',
    'Correction proposée par le joueur :',
    `"${options.proposedCorrection}"`,
    '',
    'Explication du joueur (optionnel) :',
    `"${options.explanation ?? ''}"`,
    '',
    'Sources citées par le joueur (optionnel) :',
    sources.length === 0 ? 'Aucune' : sources.join('\n'),
    '',
    'Contexte Wikipedia :',
    wikiContext === '' ? 'Non disponible' : wikiContext,
  ].join('\n');
}

/**
 * Checks a report against Wikipedia, and says what it cost.
 *
 * The verdict is validated by `flagVerification` rather than by `json.loads`:
 * `verdict` and `recommendation` are closed unions, and today they are whatever
 * string the model returned — a sixth value would flow to the client unnoticed.
 */
export async function verifyFlag(options: VerifyOptions): Promise<VerifyReport> {
  const wikiContext = await context(options);
  const prompt = userPrompt(options, wikiContext);
  const shape: CallShape = {
    model: options.model,
    kind: 'flag_verification',
    promptChars: SYSTEM.length + prompt.length,
  };

  let generated;
  try {
    generated = await generateText({
      model: options.model,
      output: Output.object({ schema: flagsApi.flagVerification }),
      system: SYSTEM,
      prompt,
      ...(options.maxOutputTokens === undefined
        ? {}
        : { maxOutputTokens: options.maxOutputTokens }),
    });
  } catch {
    // D12 — the call still happened, and a cost recorded as zero is a cost that
    // looks free. The report is kept either way.
    return {
      call: callFailed(shape),
      verification: UNCHECKED,
      contextFound: wikiContext !== '',
    };
  }

  return {
    call: callSucceeded(shape, {
      modelId: generated.response.modelId,
      inputTokens: generated.usage.inputTokens,
      outputTokens: generated.usage.outputTokens,
      outputChars: generated.text.length,
    }),
    verification: generated.output,
    contextFound: wikiContext !== '',
  };
}
