/** @vitest-environment jsdom */

// What the page actually sends — step J.4.
//
// The browser journey proves a beacon leaves and the server counts it. It
// cannot read the body: Chromium does not expose a blob payload to the
// debugging protocol, so `postDataJSON()` is null however correct the request
// is. So the payload is asserted here, against a stubbed `navigator`.
//
// It is the assertion that keeps this endpoint what the privacy policy says it
// is. A referrer, a screen size, a client-side id: each would be a reasonable
// thing for somebody to add later, and each would turn a count of a page into
// data about a person.
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PageView } from './page-view.js';

interface Sent {
  readonly url: string;
  readonly body: unknown;
}

const sent: Sent[] = [];

beforeEach(() => {
  sent.length = 0;
  vi.stubGlobal('navigator', {
    sendBeacon: (url: string, body: Blob) => {
      // Read synchronously in the test rather than awaited in the component:
      // `sendBeacon` returns a boolean, and a component that awaited anything
      // here would be a component that can be interrupted by an unload.
      void body.text().then((text) => sent.push({ url, body: JSON.parse(text) }));
      return true;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('J.4 — the beacon', () => {
  it('posts the page it was given, and only that', async () => {
    render(<PageView page="landing" />);
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    expect(sent[0]?.url).toBe('/api/view');
    expect(sent[0]?.body).toEqual({ page: 'landing' });
    expect(Object.keys(sent[0]?.body as Record<string, unknown>)).toEqual(['page']);
  });

  it('says which page, so the two are not one number', async () => {
    render(<PageView page="entry" />);
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    expect(sent[0]?.body).toEqual({ page: 'entry' });
  });

  // React runs an effect twice under development's strict mode. A counter that
  // reads two for every one arrival is a counter nobody can use, and the guard
  // is a ref rather than a dependency array — which is what this holds.
  it('fires once, however many times the effect runs', async () => {
    const view = render(<PageView page="landing" />);
    view.rerender(<PageView page="landing" />);
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    expect(sent).toHaveLength(1);
  });
});
