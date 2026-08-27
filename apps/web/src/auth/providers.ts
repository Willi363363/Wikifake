// Which social providers this deployment offers.
//
// Not a list in the code: a list in the environment. The plan says "OAuth" and
// names no provider, because that is a deployment decision — and a game that
// cannot be developed without somebody's OAuth console is a game nobody develops.
// So every provider is optional, and the ones whose credentials are present are
// the ones offered.
import type { Env } from '@wikifake/env';

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
