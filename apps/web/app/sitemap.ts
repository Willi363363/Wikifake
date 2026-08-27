// C6.2 — `GET /sitemap.xml`, naming the routes that exist.
//
// The reason this is generated and not a static file: the routes are ours, and
// a copy under `public/` would be a second place to remember when one is added.
import type { MetadataRoute } from 'next';

import { sitemapEntries } from '../src/indexing.js';

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries();
}
