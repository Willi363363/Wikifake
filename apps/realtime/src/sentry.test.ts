// The realtime service's Sentry initialiser, held to the same contract as the
// web app's — and to the regression that moving host exposed.
//
// This file did not exist while the release was resolved behind a check on
// `FLY_APP_NAME`. On Render that variable is absent, so every error would have
// been reported with no release at all: not a crash, not a failing test, just
// stack traces pinned to nothing. The last case below is the one that would
// have caught it.
import * as Sentry from '@sentry/node';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { initSentry } from './sentry.js';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const DSN = 'https://key@sentry.io/1';
const SHA = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';

describe('initSentry', () => {
  it('does nothing when SENTRY_DSN is absent', () => {
    initSentry({});
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('omits the release when there is no deployed commit', () => {
    initSentry({ SENTRY_DSN: DSN });
    const call = vi.mocked(Sentry.init).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call?.['release']).toBeUndefined();
  });

  it('uses NODE_ENV as the environment', () => {
    initSentry({ SENTRY_DSN: DSN, NODE_ENV: 'production' });
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'production' }),
    );
  });

  // The regression. `RENDER_GIT_COMMIT` alone, with no Fly variable anywhere,
  // is exactly the environment this service now runs in.
  it('tags the release with the commit the host injected', () => {
    initSentry({ SENTRY_DSN: DSN, RENDER_GIT_COMMIT: SHA });
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: DSN, release: SHA }),
    );
  });

  // C7.2's sibling: the probe reads `/api/health`, Sentry reads this, and the
  // two must answer the same revision or an error points at the wrong source.
  it('agrees with the commit /api/health reports', async () => {
    const { deployedCommit } = await import('./deployment.js');
    const source = { SENTRY_DSN: DSN, RENDER_GIT_COMMIT: SHA };
    initSentry(source);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ release: deployedCommit(source) }),
    );
  });
});
