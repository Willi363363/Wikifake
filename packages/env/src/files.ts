// Where the environment comes from when nobody exported it.
//
// `loadEnv` validates `process.env`; it does not fill it. In a deployment the
// platform fills it, and locally nothing did: no `dotenv` anywhere — it left
// with the Python and Vite code at step 10.9 — no `--env-file`, and neither
// `tsx watch` nor `next dev` reads the repository root. So `pnpm dev` started
// two processes that saw no configuration at all and the realtime service died
// naming all four required variables.
//
// This module is what fills it, and it costs no dependency: `process.loadEnvFile`
// is Node's own, and the repository already requires Node 22 (`.nvmrc`,
// `engines`). Three lines of standard library beat a package.
import { existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

/**
 * The files read, in order of decreasing priority.
 *
 * `.env.local` first because that is the one a developer edits and never
 * commits; `.env` stays accepted so a clone that already has one keeps working.
 * "First wins" is not a convention we implement — see `loadEnvFiles`.
 */
export const ENV_FILE_NAMES = ['.env.local', '.env'] as const;

/** What makes a directory the workspace root rather than a package inside it. */
const WORKSPACE_MARKER = 'pnpm-workspace.yaml';

/**
 * The workspace root, from any directory inside it.
 *
 * Turborepo runs each task with the package directory as its working
 * directory, so `apps/realtime` and `apps/web` never see the root unless they
 * walk up to it. `undefined` when there is nothing to walk up to — a package
 * copied out of the monorepo, which is not an error, only nothing to load.
 */
export function findWorkspaceRoot(from: string = process.cwd()): string | undefined {
  const { root } = parse(from);
  let directory = from;
  for (;;) {
    if (existsSync(join(directory, WORKSPACE_MARKER))) return directory;
    if (directory === root) return undefined;
    directory = dirname(directory);
  }
}

/**
 * Loads the workspace's env files into `process.env`, and says which it read.
 *
 * **A variable already present in the real environment always wins**, and so
 * does one an earlier file set — that is `process.loadEnvFile`'s own rule, not
 * something added here, which is why the order above reads highest priority
 * first. It is also what keeps CI and production untouched: there is no file
 * there, and an exported variable would beat it anyway.
 *
 * Missing files are the normal case and are skipped, not reported: a clone with
 * only `.env.local` is exactly the setup we recommend.
 */
export function loadEnvFiles(from: string = process.cwd()): string[] {
  const root = findWorkspaceRoot(from);
  if (root === undefined) return [];

  const loaded: string[] = [];
  for (const name of ENV_FILE_NAMES) {
    const file = join(root, name);
    if (!existsSync(file)) continue;
    process.loadEnvFile(file);
    loaded.push(file);
  }
  return loaded;
}
