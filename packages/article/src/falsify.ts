// Asking the model to plant false facts, and believing only what the schema
// accepts.
//
// What disappears here is about 130 lines of parsing heuristics that were
// business logic by accident: stripping Markdown fences, falling back from the
// first `[` to the last `]` when the JSON did not parse, unwrapping an envelope
// object, an all-or-nothing policy on indices, a positional fallback when the
// model renumbered them, and a second request for whatever the first one lost.
// Every one of those existed because the answer was a string. Ask for an object
// and they are all the same line: the schema either validates or it does not.
//
// The prompt is carried over **verbatim**, in French, because this phase's
// pitfall says so: `generateObject` may already change the model's behaviour, and
// mixing a stack change with a prompt change means never knowing which one moved
// the quality. It is the prompt actually in use, not the dead one in
// `core/prompts.py`.
import type { LlmCallRecord } from '@wikifake/protocol';
import { generateText, Output, type LanguageModel } from 'ai';
import { z } from 'zod';

import { callFailed, callSucceeded, type CallShape } from './accounting.js';
import { failed, ok, type Result } from './result.js';

/**
 * The falsifiability floor: a paragraph shorter than this has nothing to bend.
 *
 * One constant. Today it is `MIN_FALSIFIABLE_CHARS` in settings **and**
 * `MIN_PARAGRAPH_LENGTH = 100` hard-coded in `misinformation.py`, which is the
 * duplication D8 names and this phase's last pitfall asks to close.
 */
export const MIN_FALSIFIABLE_CHARS = 100;

/** How many paragraphs to falsify, from `NUM_FAKES`. */
export const FALSIFICATIONS_PER_ARTICLE = 4;

/**
 * What the model must return, per paragraph.
 *
 * `paragraphIndex` is the index that was handed to it. Nothing renumbers it and
 * nothing infers it from position: the historical bug was exactly a position
 * being trusted over an index.
 */
const falsification = z.object({
  paragraphIndex: z.number().int().min(0),
  swappedText: z.string().min(1),
  explanation: z.string().min(1),
  hint: z.string().min(1),
});

const answer = z.object({ falsifications: z.array(falsification).min(1) });

export type Falsification = z.infer<typeof falsification>;

/** A paragraph offered to the model, with the index it must quote back. */
export interface Candidate {
  readonly index: number;
  readonly text: string;
}

/**
 * The paragraphs worth falsifying.
 *
 * The index is the **collected** index, so it stays comparable with everything
 * else in the chain even though the short paragraphs are dropped here.
 */
export function falsifiableCandidates(
  paragraphs: readonly string[],
): readonly Candidate[] {
  return paragraphs
    .map((text, index) => ({ index, text }))
    .filter((candidate) => candidate.text.trim().length >= MIN_FALSIFIABLE_CHARS);
}

/** The system prompt, verbatim from `misinformation.py`. */
function systemPrompt(topic: string): string {
  return `
Tu es un expert en création de désinformation crédible pour un jeu éducatif.
On te donne plusieurs paragraphes d'un article Wikipedia sur "${topic}".
Pour CHAQUE paragraphe fourni dans la liste, modifie-le subtilement pour y introduire UNE fausse information crédible.
Il ne s'agit pas de changer tout le paragraphe, mais de modifier un fait (une date, un rôle historique, un lieu, une cause, etc) pour que ça paraisse tout à fait vrai pour un lecteur inattentif.

Tu dois retourner un tableau JSON d'objets (un par paragraphe dans le même ordre) avec exactement ces clés :
- "paragraph_index": l'indice d'origine fourni dans la requête (un entier).
- "swapped_text": Le paragraphe complet modifié.
- "explanation": Une explication très courte (1 phrase) sur LA VÉRITÉ.
- "hint": Un indice très court pour aider le joueur (ex: "Vérifiez cette date d'élection").

Assure-toi de renvoyer UNIQUEMENT le tableau JSON valide, sans autres textes.
`.trim();
}

/**
 * The paragraphs, as the model receives them.
 *
 * **Whole.** The current code sends `text[:1000]`, so a paragraph longer than
 * that is falsified from a truncated version and then served in full: the model
 * rewrites an ending it never saw, and the player reads a paragraph whose second
 * half contradicts its first. Nothing is cut here.
 */
function userPrompt(candidates: readonly Candidate[]): string {
  return `Paragraphes à modifier :\n${JSON.stringify(
    candidates.map((candidate) => ({
      paragraph_index: candidate.index,
      original_text: candidate.text,
    })),
    null,
    0,
  )}`;
}

export interface FalsifyOptions {
  readonly model: LanguageModel;
  readonly topic: string;
  readonly candidates: readonly Candidate[];
  /** From `MAX_OUTPUT_TOKENS`: a truncated answer used to lose the whole batch. */
  readonly maxOutputTokens?: number;
}

export interface FalsifyOutcome {
  readonly falsifications: readonly Falsification[];
}

/**
 * What happened, and what it cost — separately.
 *
 * The two travel together because a failed call still costs money. Returning only
 * a `Result` is how `usage.py` loses its failures: the error propagates, the
 * tokens do not, and `/api/usage` reports a spend lower than the invoice.
 */
export interface FalsifyReport {
  /** Null when the model was never called: nothing was spent, so nothing is recorded. */
  readonly call: LlmCallRecord | null;
  readonly result: Result<FalsifyOutcome>;
}

/**
 * Asks the model to falsify the candidates.
 *
 * Returns only falsifications that quote an index it was actually offered. A
 * model that invents an index is not "partially right": it is describing a
 * paragraph nobody will be graded on, and the current positional fallback turned
 * that into a wrong grade rather than a dropped result.
 */
export async function falsify(options: FalsifyOptions): Promise<FalsifyReport> {
  if (options.candidates.length === 0) {
    return {
      call: null,
      result: failed('unexpected_response', 'no paragraph is long enough to falsify'),
    };
  }

  const offered = new Set(options.candidates.map((candidate) => candidate.index));
  const system = systemPrompt(options.topic);
  const prompt = userPrompt(options.candidates);
  const shape: CallShape = {
    model: options.model,
    kind: 'falsification',
    promptChars: system.length + prompt.length,
  };

  let generated;
  try {
    generated = await generateText({
      model: options.model,
      output: Output.object({ schema: answer }),
      system,
      prompt,
      ...(options.maxOutputTokens === undefined
        ? {}
        : { maxOutputTokens: options.maxOutputTokens }),
    });
  } catch (error) {
    // A schema the answer does not satisfy lands here, and that is the point:
    // one failure path instead of six heuristics guessing at a string.
    return {
      call: callFailed(shape),
      result: failed(
        'unexpected_response',
        error instanceof Error ? error.message : String(error),
      ),
    };
  }

  // The model answered, so the call is not a failure even when the answer turns
  // out to be unusable: the tokens were spent either way, and hiding them would
  // under-report the bill. What a rejected answer does not produce is a *game*,
  // which is the other half of C4.5 and is enforced by there being no game row.
  const call = callSucceeded(shape, {
    modelId: generated.response.modelId,
    inputTokens: generated.usage.inputTokens,
    outputTokens: generated.usage.outputTokens,
    outputChars: generated.text.length,
  });

  const kept = generated.output.falsifications.filter((item) =>
    offered.has(item.paragraphIndex),
  );
  if (kept.length === 0) {
    return {
      call,
      result: failed('unexpected_response', 'the model quoted no index it was given'),
    };
  }

  // One per paragraph: a model that falsifies the same index twice would
  // otherwise produce two positions on one paragraph, which C3.3 forbids.
  const byIndex = new Map<number, Falsification>();
  for (const item of kept) byIndex.set(item.paragraphIndex, item);

  return {
    call,
    result: ok({
      falsifications: [...byIndex.values()].sort(
        (a, b) => a.paragraphIndex - b.paragraphIndex,
      ),
    }),
  };
}
