// The environment is validated once, at startup, and fails loudly.
//
// Without that, a missing variable shows up three layers later as an
// inexplicable `undefined` — typically a request to `undefined/api`. Here the
// process refuses to start, naming what is missing.
import { z } from 'zod';

/**
 * The model served when none is configured.
 *
 * Exported because `/api/health` reports which model is in use and must not
 * validate the whole environment to do it — a health probe that needs a working
 * database to answer is a probe that goes silent exactly when it is needed. So it
 * reads `MODEL_NAME` itself, and takes the default from here rather than
 * retyping the string.
 */
export const DEFAULT_MODEL_NAME = 'gemini-3.1-flash-lite';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // The protocol is part of the validation: an https:// "database" URL is a
  // valid URL and a useless one. Checking it here is what makes the failure
  // fast, rather than surfacing when the client finally tries to connect.
  /** Postgres — phase 2. */
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: 'DATABASE_URL must be a postgres:// or postgresql:// URL',
  }),

  /** Redis — article cache and room state, phases 3 and 5. */
  REDIS_URL: z.url({
    protocol: /^rediss?$/,
    error: 'REDIS_URL must be a redis:// or rediss:// URL',
  }),

  /** Language model — phase 3. */
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1, 'model API key is missing'),
  MODEL_NAME: z.string().min(1).default(DEFAULT_MODEL_NAME),
  /**
   * Where the two upstreams are, when they are not where they normally are.
   *
   * Both absent in every deployment. They exist so the browser tests of step
   * 9.5 can serve the article from a fixture and answer the model call locally,
   * without a seam in the application: what differs between a test run and a
   * real one is two environment variables, not a branch in the code.
   */
  WIKIPEDIA_API_URL: z.url().optional(),
  MODEL_BASE_URL: z.url().optional(),

  /**
   * Better Auth — phase 4.
   *
   * The secret signs every session cookie, so a short one is not a weak
   * configuration but a forgeable session. Thirty-two characters is Better
   * Auth's own floor, checked here so the failure is a startup message naming
   * the variable rather than a subtle one later.
   */
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters: it signs sessions'),
  /** Where the app answers. OAuth redirect URIs are built from it. */
  BETTER_AUTH_URL: z.url().default('http://localhost:3000'),

  /**
   * Which origins the realtime service accepts sockets from — phase 5.
   *
   * A comma-separated list. Optional, and the service falls back to
   * `BETTER_AUTH_URL`: the web app is the only legitimate origin, and a
   * deployment that has not thought about it should accept its own app rather
   * than everything. Preview deployments and a second domain are what the list
   * is for.
   *
   * Declared here rather than read raw in the service, so a typo in the variable
   * name fails at startup like every other one.
   */
  REALTIME_ALLOWED_ORIGINS: z.string().min(1).optional(),

  // Social sign-in, per provider, both halves or neither. Optional because the
  // game must stay playable — and developable — without any provider
  // configured: `providers.ts` turns on exactly the ones whose credentials are
  // present.
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GITHUB_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),

  /**
   * Sentry DSN — error tracking for both services.
   *
   * Optional: absent locally and in CI, which is intentional. Sentry is not a
   * development tool; its absence means "this process does not report to Sentry"
   * rather than a misconfigured one. Present only on Vercel and Fly.io.
   */
  SENTRY_DSN: z.url().optional(),
});

export type Env = z.infer<typeof schema>;

export class EnvError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'EnvError';
  }
}

/**
 * Validates a source of environment variables.
 *
 * @throws {EnvError} naming every offending variable — never its value, which
 * may be a secret.
 */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = schema.safeParse(source);
  if (result.success) return result.data;

  const issues = result.error.issues.map((issue) => {
    const name = issue.path.join('.') || '(root)';
    return `${name}: ${issue.message}`;
  });
  throw new EnvError(issues);
}
