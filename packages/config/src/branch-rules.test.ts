// `scripts/checks.sh` is the repository's rule engine: the local hooks and CI
// both run it, so a regression in it silently disarms a rule on both sides at
// once. It lives with the shared configuration for the same reason
// `tsconfig.test.ts` does — these are the repository's own rules, tested like
// any other.
//
// Covered here: the `branch` command, and the single case where a protected
// branch is a legitimate pull request head — the `staging` → `main` promotion
// of plans/method/01-git-flow.md. Before this test, that promotion could not
// pass its own conformance check.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function checks(...args: string[]): number {
  const run = spawnSync('bash', ['scripts/checks.sh', ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (run.error) throw run.error;
  return run.status ?? 1;
}

describe('checks.sh branch', () => {
  it.each([
    ['fix/promotion-guard'],
    ['feat/rewrite-phase-1'],
    ['dependabot/npm_and_yarn/vitest-3.2.5'],
  ])('accepts %s', (name) => {
    expect(checks('branch', name)).toBe(0);
  });

  it.each([['main'], ['staging'], ['master'], ['Fix/Uppercase'], ['single-segment']])(
    'rejects %s',
    (name) => {
      expect(checks('branch', name)).not.toBe(0);
    },
  );

  it('accepts the documented staging to main promotion', () => {
    expect(checks('branch', 'staging', 'main')).toBe(0);
  });

  it.each([
    ['main', 'staging'],
    ['staging', 'staging'],
    ['main', 'main'],
  ])('still rejects %s targeting %s', (head, base) => {
    expect(checks('branch', head, base)).not.toBe(0);
  });

  it('applies the rules in full when no base is named', () => {
    expect(checks('branch', 'staging', '')).not.toBe(0);
  });
});

describe('checks.sh commit-range', () => {
  it('skips commit checks for the documented staging to main promotion', () => {
    expect(checks('commit-range', 'deadbeef', 'badc0de', 'staging', 'main')).toBe(0);
  });

  it('still checks non-promotion ranges', () => {
    expect(
      checks('commit-range', 'deadbeef', 'badc0de', 'feat/demo', 'staging'),
    ).not.toBe(0);
  });
});

describe('checks.sh push', () => {
  // The promotion exemption belongs to pull request heads only. A push to a
  // protected branch stays refused, whatever a caller passes alongside it.
  it.each([['main'], ['staging']])('refuses a push to %s', (name) => {
    expect(checks('push', name)).not.toBe(0);
  });
});
