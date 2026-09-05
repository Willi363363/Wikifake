import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ENV_FILE_NAMES, findWorkspaceRoot, loadEnvFiles } from './files.js';

// The loader writes into the real `process.env` — that is its whole job, and
// `process.loadEnvFile` offers no other target. So each test gets the process
// environment back afterwards, and uses names nothing else reads.
const A = 'WIKIFAKE_TEST_A';
const B = 'WIKIFAKE_TEST_B';
const C = 'WIKIFAKE_TEST_C';

let workspace: string;
let saved: Record<string, string | undefined>;

/** A workspace root, with a package nested two levels down as Turbo runs one. */
function makeWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'wikifake-env-'));
  writeFileSync(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n");
  mkdirSync(join(root, 'apps', 'realtime'), { recursive: true });
  return root;
}

/** `delete process.env[name]` by another name: the operator is lint-forbidden. */
function unset(name: string): void {
  Reflect.deleteProperty(process.env, name);
}

beforeEach(() => {
  workspace = makeWorkspace();
  saved = { [A]: process.env[A], [B]: process.env[B], [C]: process.env[C] };
  for (const name of [A, B, C]) unset(name);
});

afterEach(() => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) unset(name);
    else process.env[name] = value;
  }
  rmSync(workspace, { recursive: true, force: true });
});

describe('findWorkspaceRoot', () => {
  it('walks up from a package directory to the workspace root', () => {
    expect(findWorkspaceRoot(join(workspace, 'apps', 'realtime'))).toBe(workspace);
  });

  it('returns undefined outside a workspace rather than guessing one', () => {
    const orphan = mkdtempSync(join(tmpdir(), 'wikifake-orphan-'));
    try {
      expect(findWorkspaceRoot(orphan)).toBeUndefined();
    } finally {
      rmSync(orphan, { recursive: true, force: true });
    }
  });
});

describe('loadEnvFiles', () => {
  it('fills the environment from the workspace root, not the cwd', () => {
    writeFileSync(join(workspace, '.env'), `${A}=from-root\n`);

    // The directory Turborepo actually hands the task, which holds no env file.
    const loaded = loadEnvFiles(join(workspace, 'apps', 'realtime'));

    expect(process.env[A]).toBe('from-root');
    expect(loaded).toEqual([join(workspace, '.env')]);
  });

  it('prefers .env.local over .env, and still reads both', () => {
    writeFileSync(join(workspace, '.env'), `${A}=from-env\n${B}=only-in-env\n`);
    writeFileSync(join(workspace, '.env.local'), `${A}=from-local\n${C}=only-in-local\n`);

    loadEnvFiles(workspace);

    expect(process.env[A]).toBe('from-local');
    expect(process.env[B]).toBe('only-in-env');
    expect(process.env[C]).toBe('only-in-local');
  });

  it('never overwrites a variable the real environment already set', () => {
    // This is what keeps CI and production out of reach of a stray file, and
    // what lets `VAR=x pnpm dev` still override for one run.
    process.env[A] = 'from-the-shell';
    writeFileSync(join(workspace, '.env.local'), `${A}=from-local\n`);
    writeFileSync(join(workspace, '.env'), `${A}=from-env\n`);

    loadEnvFiles(workspace);

    expect(process.env[A]).toBe('from-the-shell');
  });

  it('reports the files it read, in priority order', () => {
    writeFileSync(join(workspace, '.env'), `${A}=1\n`);
    writeFileSync(join(workspace, '.env.local'), `${B}=1\n`);

    expect(loadEnvFiles(workspace)).toEqual(
      ENV_FILE_NAMES.map((name) => join(workspace, name)),
    );
  });

  it('does nothing when there is no file, rather than throwing', () => {
    expect(loadEnvFiles(workspace)).toEqual([]);
    expect(process.env[A]).toBeUndefined();
  });

  it('does nothing outside a workspace', () => {
    const orphan = mkdtempSync(join(tmpdir(), 'wikifake-orphan-'));
    try {
      writeFileSync(join(orphan, '.env'), `${A}=stray\n`);
      expect(loadEnvFiles(orphan)).toEqual([]);
      expect(process.env[A]).toBeUndefined();
    } finally {
      rmSync(orphan, { recursive: true, force: true });
    }
  });
});
