// Which social providers this deployment offers.
//
// Not a list in the code: a list in the environment. The plan says "OAuth" and
// names no provider, because that is a deployment decision — and a game that
// cannot be developed without somebody's OAuth console is a game nobody develops.
// So every provider is optional, and the ones whose credentials are present are
// the ones offered.
import type { Env } from '@wikifake/env';

import type { Environment } from '../deployment.js';

export interface OAuthCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

/** The providers this code knows how to offer, and where each reads its pair. */
const KNOWN = [
  { id: 'google', prefix: 'GOOGLE_OAUTH' },
  { id: 'github', prefix: 'GITHUB_OAUTH' },
] as const;

export type ProviderId = (typeof KNOWN)[number]['id'];

/**
 * The configured providers.
 *
 * A provider with **one** half of its pair throws, naming the missing variable.
 * Silently not offering it would be worse: somebody set a client id on purpose,
 * and the sign-in button they were expecting would simply be absent, with
 * nothing anywhere saying why.
 */
export function socialProviders(env: Env): Partial<Record<ProviderId, OAuthCredentials>> {
  const configured: Partial<Record<ProviderId, OAuthCredentials>> = {};

  for (const provider of KNOWN) {
    const clientId = env[`${provider.prefix}_CLIENT_ID`];
    const clientSecret = env[`${provider.prefix}_CLIENT_SECRET`];

    if (clientId === undefined && clientSecret === undefined) continue;
    if (clientId === undefined) {
      throw new Error(`${provider.prefix}_CLIENT_ID is missing, but its secret is set`);
    }
    if (clientSecret === undefined) {
      throw new Error(`${provider.prefix}_CLIENT_SECRET is missing, but its id is set`);
    }

    configured[provider.id] = { clientId, clientSecret };
  }

  return configured;
}

/** The redirect URI a provider's console has to be told about. */
export function callbackUrl(baseUrl: string, provider: ProviderId): string {
  return new URL(`/api/auth/callback/${provider}`, baseUrl).toString();
}

/** Hosts that mean "this machine", and therefore never mean "this deployment". */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0']);

/**
 * Whether a platform is hosting this, rather than a developer.
 *
 * The same variables `deployment.ts` reads for the commit, plus the one a
 * self-managed host sets. `NODE_ENV` is deliberately last and is not enough on
 * its own — a production build run on a laptop is still a laptop.
 */
function isDeployed(source: Environment): boolean {
  return (
    source['VERCEL'] !== undefined ||
    source['RENDER'] !== undefined ||
    source['FLY_APP_NAME'] !== undefined ||
    source['NODE_ENV'] === 'production'
  );
}

/**
 * Refuses a deployment that offers OAuth from a `BETTER_AUTH_URL` nobody can
 * reach.
 *
 * `BETTER_AUTH_URL` defaults to `http://localhost:3000`, which is right for a
 * laptop and silent everywhere else. A deployment that never set it builds
 * every redirect URI against that default, so the provider sends the player to
 * *their own machine* after they authenticate — and the failure is a browser
 * that lands on nothing with no message anywhere naming the cause. The same
 * default also decides `REALTIME_ALLOWED_ORIGINS`' fallback and the canonical
 * URL in `indexing.ts`, so it is one variable with three silent consequences.
 *
 * Checked only where a provider is actually configured, which is the situation
 * step E.1 creates and the only one where this can be wrong: a deployment with
 * no OAuth has no redirect URI to get wrong, and refusing to start it would be
 * refusing a game that works.
 *
 * A throw rather than a warning, for `providers.ts`'s own reason: somebody set
 * a client id on purpose, and the alternative is a sign-in button that goes
 * nowhere with nothing anywhere saying why.
 */
export function assertCallbackReachable(
  env: Env,
  source: Environment = process.env,
): void {
  const providers = Object.keys(socialProviders(env)) as ProviderId[];
  if (providers.length === 0 || !isDeployed(source)) return;

  const { hostname } = new URL(env.BETTER_AUTH_URL);
  if (!LOCAL_HOSTS.has(hostname)) return;

  // Names the variable, the value it has, and the URI the console was supposed
  // to be given — because the next thing whoever reads this has to do is paste
  // that string into a provider's console.
  throw new Error(
    `BETTER_AUTH_URL is ${env.BETTER_AUTH_URL} on a deployed environment, ` +
      `so ${providers.join(' and ')} would send players to their own machine. ` +
      `Set it to this deployment's public URL; the redirect URI is then ` +
      `${callbackUrl(env.BETTER_AUTH_URL, providers[0] as ProviderId)}.`,
  );
}

/**
 * The provider ids a screen may offer, and **only** the ids.
 *
 * Step E.2 renders a button per provider, and the page that renders it is a
 * server component holding `Env` — which is one careless prop away from putting
 * a client secret in the document. So the boundary is a function whose return
 * type cannot carry one: `socialProviders` returns credentials, this returns
 * names, and the sign-in page reads this one.
 */
export function offeredProviders(env: Env): ProviderId[] {
  return Object.keys(socialProviders(env)) as ProviderId[];
}
