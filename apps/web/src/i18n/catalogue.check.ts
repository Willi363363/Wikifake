// The French catalogue, held to the English keys at build time.
//
// `catalogue.test.ts` already refuses a drifted key set — but a test only
// fails when it runs. Step 11.6's bar is stricter: the *build* fails on a
// missing key. This file is that bar. Every French zone file is imported as a
// type and checked against the shape of its English counterpart — same keys,
// string leaves — in both directions, so a key missing in French, a key French
// has that English lost, or a leaf that stopped being a message is a compile
// error in `tsc --noEmit` and in `next build`, before any test runs.
//
// Type-level on purpose: nothing here survives compilation, so the guard
// costs the bundle nothing. New zone? Add its pair below — the same moment
// `ZONES` in `catalogue.ts` grows.
import type { CatalogueMessages } from './catalogue.js';

import type frHome from '../../messages/fr/home.json';
import type frLanguage from '../../messages/fr/language.json';
import type frLobby from '../../messages/fr/lobby.json';
import type frRound from '../../messages/fr/round.json';
import type frRoutes from '../../messages/fr/routes.json';
import type frSeo from '../../messages/fr/seo.json';
import type frSmall from '../../messages/fr/small.json';
import type frWaiting from '../../messages/fr/waiting.json';

/** The English zone's shape with its prose erased: same tree, string leaves. */
type ShapeOf<Zone> = {
  [Key in keyof Zone]: Zone[Key] extends string ? string : ShapeOf<Zone[Key]>;
};

/** Compiles only when `Candidate` structurally covers `Reference`. */
type Covers<Candidate extends Reference, Reference> = Candidate;

/**
 * Two lines per zone: the French file covers the English shape (a missing
 * French key refuses to compile), and the English shape covers the French
 * one (a key only French has refuses too). The error names the zone.
 */
export type FrenchCarriesEveryEnglishKey = [
  Covers<typeof frHome, ShapeOf<CatalogueMessages['home']>>,
  Covers<typeof frLanguage, ShapeOf<CatalogueMessages['language']>>,
  Covers<typeof frLobby, ShapeOf<CatalogueMessages['lobby']>>,
  Covers<typeof frRound, ShapeOf<CatalogueMessages['round']>>,
  Covers<typeof frRoutes, ShapeOf<CatalogueMessages['routes']>>,
  Covers<typeof frSeo, ShapeOf<CatalogueMessages['seo']>>,
  Covers<typeof frSmall, ShapeOf<CatalogueMessages['small']>>,
  Covers<typeof frWaiting, ShapeOf<CatalogueMessages['waiting']>>,
];

export type FrenchAddsNoKeyOfItsOwn = [
  Covers<ShapeOf<CatalogueMessages['home']>, ShapeOf<typeof frHome>>,
  Covers<ShapeOf<CatalogueMessages['language']>, ShapeOf<typeof frLanguage>>,
  Covers<ShapeOf<CatalogueMessages['lobby']>, ShapeOf<typeof frLobby>>,
  Covers<ShapeOf<CatalogueMessages['round']>, ShapeOf<typeof frRound>>,
  Covers<ShapeOf<CatalogueMessages['routes']>, ShapeOf<typeof frRoutes>>,
  Covers<ShapeOf<CatalogueMessages['seo']>, ShapeOf<typeof frSeo>>,
  Covers<ShapeOf<CatalogueMessages['small']>, ShapeOf<typeof frSmall>>,
  Covers<ShapeOf<CatalogueMessages['waiting']>, ShapeOf<typeof frWaiting>>,
];
