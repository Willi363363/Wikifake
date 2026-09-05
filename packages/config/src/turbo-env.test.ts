// Turborepo hides variables it was not told about, and says nothing.
//
// `envMode` is undeclared, and Turbo 2 defaults to **strict**: a task receives
// only the variables it declares in `env` or `passThroughEnv`, plus Turbo's own
// system list. `dev` declared neither, so `pnpm dev` handed both services an
// empty configuration and the realtime one died naming all four variables it
// needs — a failure that looks like a bad `.env` and is not one.
//
// The loader in `@wikifake/env` fills the gap from the files; this holds the
// other half, for the variables a developer or a CI job exports by hand. It is
// a test rather than a comment in `turbo.json` because the file is JSON, and
// because the failure mode is silence.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

interface TurboConfig {
  readonly envMode?: string;
  readonly tasks: Readonly<
    Record<
      string,
      { readonly env?: readonly string[]; readonly passThroughEnv?: readonly string[] }
    >
  >;
}

const turbo = JSON.parse(readFileSync(`${ROOT}turbo.json`, 'utf8')) as TurboConfig;

/** Everything a task lets through, however it was declared. */
function visible(task: string): readonly string[] {
  const declaration = turbo.tasks[task];
  expect(declaration, `turbo.json declares no "${task}" task`).toBeDefined();
  return [...(declaration?.env ?? []), ...(declaration?.passThroughEnv ?? [])];
}

describe('turbo.json environment declarations', () => {
  it('gives dev everything build gets', () => {
    // Not a superset by accident: a variable added to `build` and forgotten on
    // `dev` is a stack that only breaks locally, which is the worst place for it.
    expect(visible('dev')).toEqual(expect.arrayContaining([...visible('build')]));
  });

  it('lets dev see NEXT_PUBLIC_*, which the browser needs to find the socket', () => {
    // `NEXT_PUBLIC_REALTIME_URL` is inlined into the bundle. Stripped, the
    // client falls back to the page's own origin — :3000, where nothing
    // listens — and a room never connects.
    expect(visible('dev')).toContain('NEXT_PUBLIC_*');
  });

  it('leaves the two entry-point variables to the loader, not to Turbo', () => {
    // `dev` is not cached, so these belong in `passThroughEnv`: listing them in
    // `env` would only add them to a hash nothing reads.
    expect(turbo.tasks['dev']?.env).toBeUndefined();
    expect(turbo.tasks['dev']?.passThroughEnv).toContain('DATABASE_URL');
  });
});
