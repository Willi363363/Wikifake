// Better Auth, on the project's own Postgres.
//
// The four tables come from `@wikifake/db` — phase 2 laid them down in Better
// Auth's documented shapes precisely so this step configures an adapter instead
// of migrating on arrival. Verified against `getAuthTables` in 1.7.1 rather than
// against the documentation: `account.issuer` really is required, which the
// phase 2 sheet had guessed and could have got wrong.
import {
  account,
  attachGuestRecords,
  session,
  user,
  verification,
  type Database,
} from '@wikifake/db';
import { connectFromEnv } from '@wikifake/db';
import { loadEnv, type Env } from '@wikifake/env';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins';

import { socialProviders, type OAuthCredentials, type ProviderId } from './providers.js';

export interface AuthOptions {
  readonly db: Database['db'];
  readonly secret: string;
  readonly baseURL: string;
  readonly providers?: Partial<Record<ProviderId, OAuthCredentials>>;
}

/**
 * An auth instance over a given database.
 *
 * Takes the connection rather than opening one, so a test can point it at its
 * own database. The four tables are passed by name because the adapter matches
 * on the model name — `user`, `session`, `account`, `verification` — and a
 * mismatch there fails at the first query rather than at startup.
 */
// The return type is inferred, not annotated: `betterAuth` is generic over the
// options it was given, and naming the loose `Auth<BetterAuthOptions>` instead
// throws away exactly the knowledge the caller needs.
export function createAuth(options: AuthOptions) {
  return betterAuth({
    database: drizzleAdapter(options.db, {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    secret: options.secret,
    baseURL: options.baseURL,
    // Email and password, always. Not because it is the interesting path, but
    // because the game must be playable and developable with no provider
    // configured — and because the exit criterion of this step is an account
    // created, a session opened and closed, which must not depend on a third
    // party being reachable.
    emailAndPassword: { enabled: true },
    // 4.3 — playing without signing up, without losing it afterwards.
    //
    // A guest gets an anonymous `user` row rather than a bare nickname, because
    // a nickname is not an identity: two guests type the same name, and nothing
    // else connects the browser that played to the account created later.
    //
    // `onLinkAccount` runs **before** the plugin deletes the anonymous row —
    // checked in its source, not assumed — which is the only order that works:
    // after the delete the rows are unreachable, and `participant.userId` is
    // `set null` on delete, so anything still pointing at the guest would come
    // out belonging to nobody.
    plugins: [
      anonymous({
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          await attachGuestRecords(options.db, anonymousUser.user.id, newUser.user.id);
        },
      }),
    ],
    ...(options.providers === undefined ? {} : { socialProviders: options.providers }),
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

/**
 * The application's auth instance, built on first use.
 *
 * Lazily, and deliberately: building it validates the whole environment and
 * opens a connection. At module load that would make importing anything in this
 * folder — from `/api/health`, say — depend on a reachable database.
 */
export function auth(env: Env = loadEnv()) {
  instance ??= createAuth({
    db: connectFromEnv().db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    providers: socialProviders(env),
  });
  return instance;
}
