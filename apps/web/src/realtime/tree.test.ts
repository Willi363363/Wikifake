// The connection is a context, and goes on being one.
//
// This is the second item of phase 7's exit gate — "no socket prop left in the
// tree, no imperative handle" — and the phase closes with 7.8, so it is locked
// here rather than left as a sentence in a plan. Step 7.1 removed `ws={socket}`
// from every component it travelled through and 7.5 removed the last
// `useImperativeHandle`; what this asserts is that neither comes back, anywhere
// in the application rather than in the one file each was removed from.
//
// A source scan, deliberately. Both defects are visible in the source and
// neither is visible in behaviour: a component that takes the socket as a prop
// works perfectly until somebody renders it one level higher.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');

function sourcesIn(directory: string): { path: string; text: string }[] {
  return readdirSync(directory).flatMap((name) => {
    if (name === 'node_modules' || name === '.next') return [];
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourcesIn(path);
    if (!/\.tsx?$/.test(name) || name.includes('.test.')) return [];
    return [
      {
        path: join(directory, name).slice(WEB.length + 1),
        text: readFileSync(path, 'utf8'),
      },
    ];
  });
}

/**
 * The file with its comments removed.
 *
 * Necessary rather than fastidious: three files explain in prose why they do
 * *not* do these things, and a scan that reads its own explanation as an offence
 * is a scan that has to be argued with instead of fixed. 7.5's version of this
 * test failed on exactly that.
 */
function code(text: string): string {
  return text.replaceAll(/\/\*[\s\S]*?\*\//g, ' ').replaceAll(/\/\/[^\n]*/g, ' ');
}

const SOURCES = [...sourcesIn(join(WEB, 'src')), ...sourcesIn(join(WEB, 'app'))].map(
  (source) => ({ ...source, text: code(source.text) }),
);

describe('phase 7 exit gate — the connection is a context', () => {
  it('has sources to check', () => {
    expect(SOURCES.length).toBeGreaterThan(20);
  });

  it('passes no socket as a prop', () => {
    // `ws={socket}` travelled through the lobby, the player list, the chat, the
    // session and the item panel, and every one of them had to know whether it
    // was null yet.
    const offenders = SOURCES.filter(({ text }) => /\b(ws|socket)=\{/.test(text)).map(
      ({ path }) => path,
    );
    expect(offenders).toEqual([]);
  });

  it('exposes no imperative handle', () => {
    const offenders = SOURCES.filter(({ text }) =>
      /\b(forwardRef|useImperativeHandle)\s*\(/.test(text),
    ).map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  it('reads the connection from the context, and in one place per screen', () => {
    // Not a ban — a presence check. If nothing calls `useRealtime`, the two
    // assertions above pass on an application that has no connection at all.
    const readers = SOURCES.filter(({ text }) =>
      /\buseRealtime(Messages)?\s*\(/.test(text),
    );
    expect(readers.length).toBeGreaterThan(2);
  });
});
