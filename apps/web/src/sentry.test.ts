// The Sentry initialiser is a no-op when the DSN is absent, and initialises
// with the right release when it is present.
//
// The "Done when" in 9.3 requires a live preview (errors must actually appear
// in Sentry with the correct commit). What is tested here is the code contract:
// the DSN gates the init, and the release is the deployed commit.
import * as Sentry from '@sentry/node';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { initSentry } from './sentry.js';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const SHA = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';

describe('initSentry', () => {
  it('does nothing when SENTRY_DSN is absent', () => {
    initSentry({});
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('initialises with the DSN and the deployed commit as release', () => {
    initSentry({ SENTRY_DSN: 'https://key@sentry.io/1', RENDER_GIT_COMMIT: SHA });
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: 'https://key@sentry.io/1', release: SHA }),
    );
  });

  it('omits the release when there is no deployed commit', () => {
    initSentry({ SENTRY_DSN: 'https://key@sentry.io/1' });
    const call = vi.mocked(Sentry.init).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call?.['release']).toBeUndefined();
  });

  it('uses the NODE_ENV as the environment', () => {
    initSentry({ SENTRY_DSN: 'https://key@sentry.io/1', NODE_ENV: 'production' });
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'production' }),
    );
  });
});
