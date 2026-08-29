// C7.2 on the realtime side. The probe polls two services now and compares the
// same `commit` key on both, so this asserts the same six fields by name — a
// shape that drifts from the web app's is a probe that verifies one of them.
import { healthApi } from '@wikifake/protocol';
import { describe, expect, it } from 'vitest';

import { deployedCommit, deploymentIdentity, VERSION } from './deployment.js';

const SHA = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';

const CONFIGURED = {
  FLY_GIT_COMMIT: SHA,
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

  it('keeps commit a present, empty string when there is no platform', () => {
    const identity = deploymentIdentity({});

    expect(identity.commit).toBe('');
    expect(identity.commitShort).toBe('');
    expect('commit' in identity).toBe(true);
  });

  it('falls back to the default model rather than to an empty one', () => {
    expect(deploymentIdentity({}).model.length).toBeGreaterThan(0);
  });

  it('says generation cannot work when the key is missing or blank', () => {
    expect(deploymentIdentity({}).llmConfigured).toBe(false);
    expect(deploymentIdentity({ GOOGLE_GENERATIVE_AI_API_KEY: '' }).llmConfigured).toBe(
      false,
    );
  });

  // The whole point of the shared shape: the schema that types the web app's
  // response types this one, so a field added on one side and not the other
  // fails here rather than in production.
  it('satisfies the schema the web app answers with', () => {
    expect(() =>
      healthApi.healthResponse.parse(deploymentIdentity(CONFIGURED)),
    ).not.toThrow();
  });
});

describe('the commit, from whichever platform provided it', () => {
  // Render supplies RENDER_GIT_COMMIT itself, which is why it comes first: it is
  // this service's host. FLY_GIT_COMMIT stays behind it because Fly injects no
  // commit of its own and had to have one baked in as a build argument; the last
  // two are there for a generic Docker host. A missing name is a probe that
  // waits for a match that cannot come.
  it('prefers RENDER, then FLY, then GIT_COMMIT, then SOURCE_COMMIT', () => {
    expect(
      deployedCommit({
        RENDER_GIT_COMMIT: 'r',
        FLY_GIT_COMMIT: 'f',
        GIT_COMMIT: 'g',
        SOURCE_COMMIT: 's',
      }),
    ).toBe('r');
    expect(
      deployedCommit({ FLY_GIT_COMMIT: 'f', GIT_COMMIT: 'g', SOURCE_COMMIT: 's' }),
    ).toBe('f');
    expect(deployedCommit({ GIT_COMMIT: 'g', SOURCE_COMMIT: 's' })).toBe('g');
    expect(deployedCommit({ SOURCE_COMMIT: 's' })).toBe('s');
    expect(deployedCommit({})).toBe('');
  });

  // The regression this PR exists to prevent: the service is deployed on Render,
  // and a chain that does not name Render's variable answers an empty commit
  // while every other field looks right.
  it('answers the Render commit when that is the only name present', () => {
    expect(deployedCommit({ RENDER_GIT_COMMIT: SHA })).toBe(SHA);
  });
});

describe('the API key never appears', () => {
  // Not shaped like a real credential, and saying "FAKE" out loud: the
  // repository's secret scanner refuses a convincing one, and rightly.
  const SECRET = 'FAKE-MODEL-KEY-THAT-MUST-NEVER-BE-SERVED';

  // By values, not by keys: renaming a key is enough to fool a key-based test,
  // so this searches the serialised payload for the secret itself.
  it('is nowhere in the serialised payload', () => {
    const serialised = JSON.stringify(
      deploymentIdentity({ ...CONFIGURED, GOOGLE_GENERATIVE_AI_API_KEY: SECRET }),
    );

    expect(serialised).not.toContain(SECRET);
    expect(serialised).toContain('"llmConfigured":true');
  });
});
