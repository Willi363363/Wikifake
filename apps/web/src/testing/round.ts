// What a web round's assertions need, on top of the shared fixtures.
//
// The fixtures themselves — the markers, the paragraphs, the mocked Wikipedia
// and the mocked model — moved to `@wikifake/article/testing` when the realtime
// service started generating rounds through the same chain (step 5.8). They are
// re-exported here so a suite still asks one place for "a round I can start
// without a network"; what is *defined* here is HTTP, and neither of the two
// below means anything to a socket.
export {
  falsifier,
  refuser,
  wikipedia,
  HINT,
  HTML,
  ORIGINAL,
  PAGE,
  PARAGRAPHS,
  SEARCH,
  TRUTH,
} from '@wikifake/article/testing';

/** Every key of an object graph, at any depth. */
export function allKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, found);
    return found;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      found.push(key);
      allKeys(nested, found);
    }
  }
  return found;
}

/** The cookies a response sets, folded into one header a request can send back. */
export function cookieFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((raw) => raw.split(';')[0])
    .filter((pair): pair is string => pair !== undefined)
    .join('; ');
}
