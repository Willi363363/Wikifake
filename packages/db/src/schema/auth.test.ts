// The integration test the step asks for: insert a user and its profile, read
// them back typed.
//
// Against a real Postgres, migrated from the committed migrations. A test
// against a mock would prove the query builder compiles and nothing about the
// schema.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  openTestDatabase,
  rejectionCode,
  SQLSTATE,
  testDatabaseUrl,
  type TestDatabase,
} from '../testing/database.js';
import { account, profile, session, user, verification } from './index.js';

const url = testDatabaseUrl();

describe.skipIf(url === null)('the auth tables', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await openTestDatabase(url as string);
  });
  afterAll(async () => {
    await database.close();
  });
  beforeEach(async () => {
    await database.truncate();
  });

  const ada = {
    id: 'user_ada',
    name: 'Ada Lovelace',
    email: 'ada@example.org',
  };

  it('inserts a user and reads it back', async () => {
    await database.db.insert(user).values(ada);
    const [found] = await database.db.select().from(user).where(eq(user.id, ada.id));

    expect(found?.email).toBe('ada@example.org');
    // Defaults are the schema's, not the caller's: a caller that forgets them
    // must not get a half-built row.
    expect(found?.emailVerified).toBe(false);
    expect(found?.image).toBe(null);
    expect(found?.createdAt).toBeInstanceOf(Date);
  });

  it('refuses two accounts on one email address', async () => {
    await database.db.insert(user).values(ada);
    const code = await rejectionCode(
      database.db.insert(user).values({ ...ada, id: 'user_other' }),
    );
    expect(code).toBe(SQLSTATE.uniqueViolation);
  });

  it('inserts a profile and reads it back with the user', async () => {
    await database.db.insert(user).values(ada);
    await database.db.insert(profile).values({ userId: ada.id, displayName: 'ada' });

    const [row] = await database.db
      .select({
        email: user.email,
        displayName: profile.displayName,
        accent: profile.accent,
      })
      .from(profile)
      .innerJoin(user, eq(profile.userId, user.id));

    expect(row).toEqual({ email: 'ada@example.org', displayName: 'ada', accent: 'teal' });
  });

  it('keeps preferences as an object, not a string', async () => {
    await database.db.insert(user).values(ada);
    await database.db
      .insert(profile)
      .values({ userId: ada.id, displayName: 'ada', preferences: { sound: false } });

    const [row] = await database.db.select().from(profile);
    expect(row?.preferences).toEqual({ sound: false });
  });

  it('gives a profile no user to hang off', async () => {
    const code = await rejectionCode(
      database.db.insert(profile).values({ userId: 'nobody', displayName: 'ghost' }),
    );
    expect(code).toBe(SQLSTATE.foreignKeyViolation);
  });

  // A session pointing at nobody is a way in, so a deleted account takes its
  // sessions, its provider links and its profile with it.
  it('takes everything with a deleted account', async () => {
    await database.db.insert(user).values(ada);
    await database.db.insert(profile).values({ userId: ada.id, displayName: 'ada' });
    await database.db.insert(session).values({
      id: 'session_1',
      userId: ada.id,
      token: 'token_1',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
    });
    await database.db.insert(account).values({
      id: 'account_1',
      userId: ada.id,
      issuer: 'https://accounts.google.com',
      accountId: 'google_1',
      providerId: 'google',
    });

    await database.db.delete(user).where(eq(user.id, ada.id));

    expect(await database.db.select().from(profile)).toEqual([]);
    expect(await database.db.select().from(session)).toEqual([]);
    expect(await database.db.select().from(account)).toEqual([]);
  });

  it('refuses two provider links with the same issuer and account id', async () => {
    await database.db.insert(user).values(ada);
    const link = {
      userId: ada.id,
      issuer: 'https://accounts.google.com',
      accountId: 'google_1',
      providerId: 'google',
    };
    await database.db.insert(account).values({ ...link, id: 'account_1' });
    const code = await rejectionCode(
      database.db.insert(account).values({ ...link, id: 'account_2' }),
    );
    expect(code).toBe(SQLSTATE.uniqueViolation);
  });

  it('stores a verification token with its expiry', async () => {
    await database.db.insert(verification).values({
      id: 'verification_1',
      identifier: 'ada@example.org',
      value: 'code',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
    });
    const [row] = await database.db.select().from(verification);
    expect(row?.expiresAt).toBeInstanceOf(Date);
  });
});
