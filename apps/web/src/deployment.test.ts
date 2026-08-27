// C7.1 and C7.2, field by field. The pitfall the phase sheet names: "the
// deployment probe dies silently if /api/health changes by one field", so every
// field is asserted by name and by type, not by a snapshot that would happily
// absorb a rename.
import { describe, expect, it } from 'vitest';

import { healthApi } from '@wikifake/protocol';

import { deployedCommit, deploymentIdentity, VERSION } from './deployment.js';

const SHA = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';

const CONFIGURED = {
  RENDER_GIT_COMMIT: SHA,
  MODEL_NAME: 'gemini-3.1-flash-lite',
  GOOGLE_GENERATIVE_AI_API_KEY: 'a-key',
};

describe('C7.2 — the deployment identity', () => {
  it('has exactly the six fields the contract names', () => {
    expect(Object.keys(deploymentIdentity(CONFIGURED)).sort()).toEqual([
      'commit',
      'commitShort',
      'llmConfigured',
      'model',
      'status',
      'version',
    ]);
  });

  it('reports each of them', () => {
    const identity = deploymentIdentity(CONFIGURED);

    expect(identity.status).toBe('ok');
    expect(identity.version).toBe(VERSION);
    expect(identity.commit).toBe(SHA);
    expect(identity.commitShort).toBe('a1b2c3d');
    expect(identity.model).toBe('gemini-3.1-flash-lite');
    expect(identity.llmConfigured).toBe(true);
  });

  it('shortens the commit to seven characters', () => {
    expect(deploymentIdentity(CONFIGURED).commitShort).toHaveLength(7);
  });

  // The case the contract is explicit about: only the platform provides the
  // commit, so locally it is "". A field that were absent instead would let the
  // probe read `undefined` and wait for a match that cannot come.
  it('keeps commit a present, empty string when there is no platform', () => {
    const identity = deploymentIdentity({});

    expect(identity.commit).toBe('');
    expect(identity.commitShort).toBe('');
    expect('commit' in identity).toBe(true);
  });

  it('falls back to the default model rather than to an empty one', () => {
    expect(deploymentIdentity({}).model).not.toBe('');
    expect(deploymentIdentity({}).model.length).toBeGreaterThan(0);
  });

  it('says generation cannot work when the key is missing or blank', () => {
    expect(deploymentIdentity({}).llmConfigured).toBe(false);
    expect(deploymentIdentity({ GOOGLE_GENERATIVE_AI_API_KEY: '' }).llmConfigured).toBe(
      false,
    );
  });
});

describe('the commit, from whichever platform provided it', () => {
  // VERCEL_GIT_COMMIT_SHA is the Vercel system variable; the three Render-style
  // names follow for backward compatibility while the Python still runs there.
  // A different precedence or a missing name is a probe that waits forever.
  it('prefers VERCEL_GIT_COMMIT_SHA, then RENDER_GIT_COMMIT, GIT_COMMIT, SOURCE_COMMIT', () => {
    expect(
      deployedCommit({
        VERCEL_GIT_COMMIT_SHA: 'v',
        RENDER_GIT_COMMIT: 'r',
        GIT_COMMIT: 'g',
        SOURCE_COMMIT: 's',
      }),
    ).toBe('v');
    expect(
      deployedCommit({ RENDER_GIT_COMMIT: 'r', GIT_COMMIT: 'g', SOURCE_COMMIT: 's' }),
    ).toBe('r');
    expect(deployedCommit({ GIT_COMMIT: 'g', SOURCE_COMMIT: 's' })).toBe('g');
    expect(deployedCommit({ SOURCE_COMMIT: 's' })).toBe('s');
    expect(deployedCommit({})).toBe('');
  });
});

describe('the API key never appears', () => {
  // Deliberately not shaped like a real credential, and saying "FAKE" out loud:
  // the repository's secret scanner refuses a convincing one, and rightly. The
  // shape is not what is under test — a marker that cannot occur by accident is.
  const SECRET = 'FAKE-MODEL-KEY-THAT-MUST-NEVER-BE-SERVED';

  // By values, not by keys: the pitfall says renaming a key is enough to fool a
  // key-based test, so this searches the serialised payload for the secret
  // itself.
  it('is nowhere in the serialised payload', () => {
    const serialised = JSON.stringify(
      deploymentIdentity({ ...CONFIGURED, GOOGLE_GENERATIVE_AI_API_KEY: SECRET }),
    );

    expect(serialised).not.toContain(SECRET);
    // And the fact it is configured is still reported.
    expect(serialised).toContain('"llmConfigured":true');
  });

  it('is nowhere in the payload even under another variable name', () => {
    const serialised = JSON.stringify(
      deploymentIdentity({
        ...CONFIGURED,
        GOOGLE_API_KEY: SECRET,
        GEMINI_API_KEY: SECRET,
      }),
    );

    expect(serialised).not.toContain(SECRET);
  });
});

describe('C7.1 — the ping contract', () => {
  // Equivalent of test_ping_stays_minimal: load balancers expect exactly
  // {"status": "alive"} — the literal schema refuses anything else, including
  // the "ok" that /api/health uses.
  it('is exactly {"status": "alive"} — the literal refuses anything else', () => {
    expect(healthApi.pingResponse.parse({ status: 'alive' })).toStrictEqual({
      status: 'alive',
    });
    expect(() => healthApi.pingResponse.parse({ status: 'ok' })).toThrow();
  });
});
