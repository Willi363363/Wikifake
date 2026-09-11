'use client';

// Step J.4 — the beacon, fired once when a page it is mounted on is loaded.
//
// A client component because a static page runs no server code per visit: the
// landing is prerendered, which is what C.7's budget measures, and making it
// dynamic to count an arrival would trade the thing being measured for the
// measurement.
//
// **`sendBeacon`, not `fetch`.** The browser hands it to the network stack and
// stops caring: it survives the page being navigated away from immediately —
// which is precisely the visit worth counting, the one that bounced — and it
// cannot delay anything the reader is waiting for.
//
// It sends one field, from a closed list. No id, no cookie, no referrer, no
// timestamp: the server has a clock, and everything else would be data about a
// person rather than a count of a page.
import { useEffect, useRef } from 'react';

import type { ViewedPage } from '@wikifake/protocol';

export interface PageViewProps {
  readonly page: ViewedPage;
}

export function PageView({ page }: PageViewProps) {
  // React mounts an effect twice in development's strict mode, and a counter
  // that says two for every one arrival is a counter read by nobody twice.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const body = new Blob([JSON.stringify({ page })], { type: 'application/json' });

    // Blob rather than a string, because a bare string is sent as `text/plain`
    // and the route would refuse to parse its own request.
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/view', body);
      return;
    }

    // The fallback exists for the browsers that lack it, and `keepalive` is what
    // makes it behave the same way on an unload. A failure is swallowed on
    // purpose: an arrival that was not counted is not a problem the reader has.
    void fetch('/api/view', { method: 'POST', body, keepalive: true }).catch(() => {});
  }, [page]);

  return null;
}
