// The browser harness. Step 9.5 owns it, and it is the only step that does.
//
// Three processes, started in order by Playwright itself so a developer runs one
// command and CI runs the same one: the stub upstream, the realtime service, and
// the web application. Nothing reaches Wikipedia and nothing reaches a model —
// `WIKIPEDIA_API_URL` and `MODEL_BASE_URL` point both applications at the stub,
// which is configuration rather than a branch in the code.
//
// One browser. The journey needs two *contexts* in a room, and two contexts is
// not two browsers: a second engine would double the run for nothing, and this
// phase's own pitfall list says the four-browser journey is slow and fragile and
// should be a single short one.
import { defineConfig, devices } from '@playwright/test';

import { UPSTREAM_PORT } from './upstream/serve.js';

const WEB_PORT = 3100;
const REALTIME_PORT = 4101;

/** Everything both applications need, with the two upstreams redirected. */
const shared = {
  NODE_ENV: 'test',
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgres://postgres:wikifake@localhost:5432/wikifake',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  // "Fake key as today": the key is still required — a run with no key would
  // pass and prove nothing about the deployment that has one — and it is never
  // used, because the base URL below is not Google.
  GOOGLE_GENERATIVE_AI_API_KEY: 'test-key-that-never-reaches-a-model',
  BETTER_AUTH_SECRET: 'test-signing-secret-of-at-least-32-characters',
  BETTER_AUTH_URL: `http://localhost:${String(WEB_PORT)}`,
  WIKIPEDIA_API_URL: `http://localhost:${String(UPSTREAM_PORT)}/w/api.php`,
  MODEL_BASE_URL: `http://localhost:${String(UPSTREAM_PORT)}`,
  // Required, and the first thing this harness caught: an empty allow-list
  // refuses every browser-issued handshake on purpose — a misconfiguration that
  // fails closed is one somebody notices. Somebody being this run.
  REALTIME_ALLOWED_ORIGINS: `http://localhost:${String(WEB_PORT)}`,
};

export default defineConfig({
  testDir: './specs',
  // Serial, and on purpose: the two suites share one database and one Redis, and
  // a room code drawn twice at once is a flake nobody can reproduce.
  workers: 1,
  fullyParallel: false,
  // A browser journey that has to be retried to pass is a browser journey that
  // is telling you something. CI gets one retry for the network, and no more.
  retries: process.env.CI === undefined ? 0 : 1,
  reporter: process.env.CI === undefined ? 'list' : [['list'], ['github']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://localhost:${String(WEB_PORT)}`,
    trace: 'retain-on-failure',
    video: 'off',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      command: 'pnpm --filter @wikifake/e2e upstream',
      url: `http://localhost:${String(UPSTREAM_PORT)}/w/api.php`,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 30_000,
    },
    {
      command: 'pnpm --filter @wikifake/realtime start',
      url: `http://localhost:${String(REALTIME_PORT)}/ping`,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 60_000,
      env: { ...shared, PORT: String(REALTIME_PORT) },
    },
    {
      // Built, not `dev`: the negative assertions are about what reaches a
      // browser, and a development build serialises more into the page than a
      // production one does. Asserting against the looser of the two is the
      // only way round that is worth anything.
      // The port travels in `PORT`, which `next start` reads: an argument would
      // have to cross `pnpm --filter`, and it does not.
      command: 'pnpm --filter @wikifake/web build && pnpm --filter @wikifake/web start',
      url: `http://localhost:${String(WEB_PORT)}/ping`,
      reuseExistingServer: process.env.CI === undefined,
      timeout: 180_000,
      env: {
        ...shared,
        PORT: String(WEB_PORT),
        NEXT_PUBLIC_REALTIME_URL: `ws://localhost:${String(REALTIME_PORT)}`,
      },
    },
  ],
});
