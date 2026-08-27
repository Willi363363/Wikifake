// What a model call cost, recorded whether or not it worked.
//
// C4.5 — a failed generation is neither cached nor counted **as a generation**,
// which is not the same as not recorded. It cost tokens and it took a call, so it
// produces a record with `failed: true`; what it must never do is enter
// `perGeneratedGame`. Today `usage.py` simply loses failures, and
// `flag_verifier.py` loses its calls entirely (D12), so the endpoint under-reports
// the spend by however many reports came in.
//
// The shape lives in `@wikifake/protocol`: this package produces the records,
// `@wikifake/db` stores them and `/api/usage` reads them, and three declarations
// of one shape is D8.
import type { LlmCallRecord } from '@wikifake/protocol';
import type { LanguageModel } from 'ai';

/** The model as it was asked for — a gateway id, or an instance's own id. */
export function requestedModel(model: LanguageModel): string {
  return typeof model === 'string' ? model : model.modelId;
}

export interface CallShape {
  readonly model: LanguageModel;
  readonly kind: LlmCallRecord['kind'];
  /** Everything sent: system prompt and user prompt together. */
  readonly promptChars: number;
}

export interface CallAnswer {
  /** What the model that actually answered calls itself, when the SDK reports it. */
  readonly modelId?: string | undefined;
  readonly inputTokens?: number | undefined;
  readonly outputTokens?: number | undefined;
  readonly outputChars: number;
}

/**
 * A call that produced an answer.
 *
 * The resolved model id wins over the requested one: a gateway alias resolves to
 * a version, and "what did this cost" is a question about the version that
 * answered, not the alias that was typed.
 */
export function callSucceeded(shape: CallShape, answer: CallAnswer): LlmCallRecord {
  return {
    model: answer.modelId ?? requestedModel(shape.model),
    kind: shape.kind,
    // Null rather than zero: a provider that reported nothing has told us
    // nothing, and a zero there reads like a measurement.
    inputTokens: answer.inputTokens ?? null,
    outputTokens: answer.outputTokens ?? null,
    promptChars: shape.promptChars,
    outputChars: answer.outputChars,
    failed: false,
  };
}

/**
 * A call that failed.
 *
 * The prompt was still sent and still billed, so `promptChars` is known and kept.
 * The token counts are null because the provider never reported any — and a
 * failure whose cost is recorded as zero is a failure that looks free.
 */
export function callFailed(shape: CallShape): LlmCallRecord {
  return {
    model: requestedModel(shape.model),
    kind: shape.kind,
    inputTokens: null,
    outputTokens: null,
    promptChars: shape.promptChars,
    outputChars: 0,
    failed: true,
  };
}
