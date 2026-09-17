// Step Q.1 — the client's patience, against the host it is waiting for.
//
// **No unit test can watch a host sleep**, which is what made P.1's defect
// invisible: every case it wrote passed, and the number it chose was wrong
// about a deployment none of them could see. So this reads the deployment.
//
// What it guards is not a shared constant — Q.1 deliberately has none, because
// the loop no longer stops and so no budget has to match the server's window.
// It guards the one relationship that would make the card **lie**: it must not
// appear while the server is still holding the player's seat.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { LOST_AFTER_MS } from './provider.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** What `render.yaml` gives the socket service, in seconds. */
function graceOnTheHost(): number {
  const yaml = readFileSync(join(ROOT, 'render.yaml'), 'utf8');
  const found = /REALTIME_GRACE_SECONDS\s*\n\s*value:\s*(\d+)/u.exec(yaml);
  // A miss is a failure rather than a skip: the variable being renamed or
  // dropped is exactly the change this test exists to notice.
  expect(found).not.toBeNull();
  return Number((found as RegExpExecArray)[1]);
}

describe('Q.1 — the client waits for the host it actually has', () => {
  it('reads a grace window off the deployment', () => {
    expect(graceOnTheHost()).toBeGreaterThan(0);
  });

  /**
   * The card says the seat has been given away. It must be true when it says
   * it — P.1 showed it at thirty seconds against a ninety-second window, which
   * told sixty seconds' worth of players a falsehood about their own room.
   */
  it('never claims the seat is gone while the server still holds it', () => {
    expect(LOST_AFTER_MS).toBeGreaterThan(graceOnTheHost() * 1000);
  });

  /**
   * And it must clear this host's cold start — about a minute on Render's free
   * tier, per `04-deployment.md`. A threshold under it would show the card to
   * every player of every room left idle for fifteen minutes, which is the
   * regression Q.1 repairs rather than a case it invents.
   */
  it('outlasts a cold start on the free tier', () => {
    const COLD_START_MS = 60 * 1000;
    expect(LOST_AFTER_MS).toBeGreaterThan(COLD_START_MS);
  });
});
