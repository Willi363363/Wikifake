// The language model, built from the environment.
//
// `@wikifake/article` takes a `LanguageModel` and never builds one: that is what
// lets its tests run against `MockLanguageModelV4` with no key, no network and no
// provider package. The provider is chosen here, once, because choosing one is a
// deployment decision rather than a rule of the game.
//
// Google directly rather than through the AI Gateway, for now: the environment
// declares `GOOGLE_GENERATIVE_AI_API_KEY` and nothing else, and a gateway needs
// its own credential. Moving is a change to this file alone.
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { Env } from '@wikifake/env';
import type { LanguageModel } from 'ai';

/**
 * The model named by `MODEL_NAME`, or the default `@wikifake/env` supplies.
 *
 * The key is passed explicitly rather than left to the provider's own reading of
 * `process.env`: `loadEnv` has already refused a missing one by name, and a
 * second, silent source would make that check decorative.
 */
export function languageModel(env: Env): LanguageModel {
  const google = createGoogleGenerativeAI({
    apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
    // Absent in every deployment, and set by step 9.5's browser tests so the
    // call is answered locally. The key is still required and still passed: a
    // run with no key is a run that would pass and prove nothing about the one
    // that has one.
    ...(env.MODEL_BASE_URL === undefined ? {} : { baseURL: env.MODEL_BASE_URL }),
  });
  return google(env.MODEL_NAME);
}
