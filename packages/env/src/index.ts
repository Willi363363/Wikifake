// The environment is validated once, at startup, and fails loudly.
//
// Without that, a missing variable shows up three layers later as an
// inexplicable `undefined` — typically a request to `undefined/api`. Here the
// process refuses to start, naming what is missing.
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  /** Postgres — phase 2. */
  DATABASE_URL: z.url({ error: "DATABASE_URL must be a valid Postgres URL" }),

  /** Redis — article cache and room state, phases 3 and 5. */
  REDIS_URL: z.url({ error: "REDIS_URL must be a valid Redis URL" }),

  /** Language model — phase 3. */
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1, "model API key is missing"),
  MODEL_NAME: z.string().min(1).default("gemini-3.1-flash-lite"),
});

export type Env = z.infer<typeof schema>;

export class EnvError extends Error {
  constructor(readonly issues: string[]) {
    super(
      `Invalid configuration:\n${issues.map((i) => `  - ${i}`).join("\n")}`,
    );
    this.name = "EnvError";
  }
}

/**
 * Validates a source of environment variables.
 *
 * @throws {EnvError} naming every offending variable — never its value, which
 * may be a secret.
 */
export function loadEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const result = schema.safeParse(source);
  if (result.success) return result.data;

  const issues = result.error.issues.map((issue) => {
    const name = issue.path.join(".") || "(root)";
    return `${name}: ${issue.message}`;
  });
  throw new EnvError(issues);
}
