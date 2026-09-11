import { baseConfig } from '@wikifake/config/vitest';

// The transport tests open a real server on a real port and connect a real
// client to it: a WebSocket handshake mocked against a fake is a fake tested
// against a fake, and the guarantees of C5 are all about what happens on the
// wire. Ports are picked by the OS, so a port is not what serialises them.
export default {
  ...baseConfig,
  test: {
    ...baseConfig.test,
    /*
     * Longer than Vitest's five seconds, because `until` waits eight.
     *
     * The helper's deadline is the one that should fire: it names what it was
     * waiting for, and "Test timed out in 5000ms" names nothing. Twenty rather
     * than nine so that a test doing two waits in sequence still fails on the
     * second wait rather than on the budget above both.
     */
    testTimeout: 20_000,
    // One database, so one file at a time — the same line `apps/web` and
    // `@wikifake/db` carry, for the same reason.
    //
    // It did not apply here while a port was the only shared resource, and
    // steps 5.8 and E.3b.1 changed that: both suites open
    // `openScratchDatabase('realtime')`, which is one database, and both
    // truncate it in `beforeEach`. So `generation.test.ts` inserts the room its
    // round references, `results.test.ts` truncates between two of its own
    // cases, and the round's insert fails on a foreign key to a room that was
    // there a moment ago. It surfaced as a different test each run, which is
    // what a race looks like from the outside.
    fileParallelism: false,
    // Not because anything skips here — these suites default to a local Redis
    // and pass without a file. Because a `REDIS_URL` a developer put in
    // `.env.local` was being ignored, so the suites ran against an instance
    // nobody chose, which is the same wrongness pointing the other way.
    setupFiles: ['@wikifake/env/load'],
  },
};
