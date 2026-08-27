// C6.2 — `GET /robots.txt`, generated rather than copied.
//
// A shell on purpose: what it answers is decided in `src/indexing.ts`, where a
// test reads it without starting a server. Next serves this at `/robots.txt`.
import type { MetadataRoute } from 'next';

import { robotsRules } from '../src/indexing.js';

export default function robots(): MetadataRoute.Robots {
  return robotsRules();
}
