// `drizzle-kit` writes files without a trailing newline, and the repository's
// hygiene check requires one on every text file.
//
// Fixing it by hand once per migration is a step somebody forgets and a
// pre-commit hook then blocks on, so it runs as part of `generate`. It only ever
// appends a newline: the content drizzle wrote is never touched, because drizzle
// reads its own snapshots back to compute the next diff.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = new URL('../migrations/', import.meta.url).pathname;

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

let fixed = 0;
for (const path of walk(MIGRATIONS)) {
  const content = readFileSync(path, 'utf8');
  if (content.length > 0 && !content.endsWith('\n')) {
    writeFileSync(path, `${content}\n`);
    fixed += 1;
  }
}

process.stdout.write(
  fixed === 0
    ? 'migrations already end with a newline\n'
    : `added a trailing newline to ${fixed} file(s)\n`,
);
