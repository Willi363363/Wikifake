// Step 11.8 — what makes a 404 speak the player's language.
//
// Without this file, `[locale]/not-found.tsx` is nearly unreachable. Next's
// root `not-found.tsx` handles every URL that matches no route at all, and a
// segment's own `not-found.tsx` only answers a `notFound()` thrown by a route
// *inside* it. A typo therefore never enters the locale segment, and a French
// player gets the English root page — which is the defect this step exists to
// remove, arriving through the back door.
//
// A catch-all route fixes it by making the typo match something. It is the
// lowest-priority match in the router, so every real page still wins; what
// reaches here is exactly what reached nothing else. Calling `notFound()` from
// inside the segment then renders `[locale]/not-found.tsx`, with the layout, the
// locale and the catalogue — and still answers 404, because that is what
// `notFound()` sets.
//
// The root `not-found.tsx` stays, and is not dead: a request the proxy exempts
// from locale routing — a file, `/ping`, an API path — never enters `[locale]`
// at all, and that page is what it gets.
import { notFound } from 'next/navigation';

export default function LocaleCatchAll(): never {
  notFound();
}
