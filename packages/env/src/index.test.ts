import { describe, expect, it } from 'vitest';
import { EnvError, loadEnv } from './index.js';

const VALID = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/wikifake',
  REDIS_URL: 'redis://localhost:6379',
  GOOGLE_GENERATIVE_AI_API_KEY: 'test-key',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
};

describe('loadEnv', () => {
  it('applies default values', () => {
    const env = loadEnv(VALID);
    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.MODEL_NAME).toBe('gemini-3.1-flash-lite');
  });

  it('names the missing variable', () => {
    const { DATABASE_URL: _omitted, ...withoutDatabase } = VALID;
    expect(() => loadEnv(withoutDatabase)).toThrow(EnvError);
    expect(() => loadEnv(withoutDatabase)).toThrow(/DATABASE_URL/);
  });

  it('rejects a malformed database URL', () => {
    expect(() => loadEnv({ ...VALID, DATABASE_URL: 'not-a-url' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a valid URL on the wrong protocol', () => {
    expect(() => loadEnv({ ...VALID, DATABASE_URL: 'https://example.com/db' })).toThrow(
      /DATABASE_URL/,
    );
    expect(() => loadEnv({ ...VALID, REDIS_URL: 'postgres://localhost:5432' })).toThrow(
      /REDIS_URL/,
    );
  });

  it('accepts the secure variants', () => {
    const env = loadEnv({
      ...VALID,
      DATABASE_URL: 'postgresql://user:pass@host:5432/db',
      REDIS_URL: 'rediss://host:6379',
    });
    expect(env.REDIS_URL).toBe('rediss://host:6379');
  });

  it('never discloses the offending value', () => {
    const secret = 'sk-must-not-leak-into-the-message';
    try {
      loadEnv({ ...VALID, DATABASE_URL: secret });
      expect.unreachable('loadEnv should have failed');
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it('refuses a session secret short enough to guess', () => {
    // Not pedantry: this string signs every session cookie, so a short one is a
    // forgeable session rather than a weak setting.
    expect(() => loadEnv({ ...VALID, BETTER_AUTH_SECRET: 'short' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it('defaults the auth URL to localhost, and takes an override', () => {
    expect(loadEnv(VALID).BETTER_AUTH_URL).toBe('http://localhost:3000');
    expect(
      loadEnv({ ...VALID, BETTER_AUTH_URL: 'https://wikifake.example' }).BETTER_AUTH_URL,
    ).toBe('https://wikifake.example');
  });

  it('leaves every OAuth credential optional', () => {
    // The game must stay playable, and developable, with no provider
    // configured at all.
    const env = loadEnv(VALID);
    expect(env.GOOGLE_OAUTH_CLIENT_ID).toBeUndefined();
    expect(env.GITHUB_OAUTH_CLIENT_SECRET).toBeUndefined();
  });

  it('rejects an unknown log level', () => {
    expect(() => loadEnv({ ...VALID, LOG_LEVEL: 'verbose' })).toThrow(/LOG_LEVEL/);
  });
});
