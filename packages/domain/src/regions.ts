// Which board a player appears on — step G.1.
//
// **Three regions and not six continents.** The track asks for "Europe, the
// Americas, and the rest", and those are the boards, so those are the values. A
// finer continent would be data no feature reads — and this track's own argument
// against geolocating a player is the argument against storing more of it than
// the product uses. F.1 dropped a qualifier nothing counted for the same reason:
// a member of a union that nothing reads is a branch every later step has to
// carry.
//
// The mapping is deliberately one-sided. Europe and the Americas are named,
// exhaustively, and **everything else is `other`** — including a code this table
// has never heard of, which is what makes an unknown or a new country a rank
// rather than a crash.
import { REGION_IDS, type RegionId } from '@wikifake/protocol';

export type PlayerRegion = RegionId;

/**
 * The European codes, ISO 3166-1 alpha-2.
 *
 * Geographic Europe rather than the European Union: a board is about where
 * somebody is, and a political union changes membership. Türkiye, Russia,
 * Cyprus and the Caucasus states straddle the conventional boundary and are
 * listed here, which is a choice rather than a fact — the alternative puts
 * players who consider themselves European on the world board alone.
 */
const EUROPE: readonly string[] = [
  'AD',
  'AL',
  'AM',
  'AT',
  'AX',
  'AZ',
  'BA',
  'BE',
  'BG',
  'BY',
  'CH',
  'CY',
  'CZ',
  'DE',
  'DK',
  'EE',
  'ES',
  'FI',
  'FO',
  'FR',
  'GB',
  'GE',
  'GG',
  'GI',
  'GR',
  'HR',
  'HU',
  'IE',
  'IM',
  'IS',
  'IT',
  'JE',
  'LI',
  'LT',
  'LU',
  'LV',
  'MC',
  'MD',
  'ME',
  'MK',
  'MT',
  'NL',
  'NO',
  'PL',
  'PT',
  'RO',
  'RS',
  'RU',
  'SE',
  'SI',
  'SJ',
  'SK',
  'SM',
  'TR',
  'UA',
  'VA',
  'XK',
];

/**
 * The Americas, north and south together.
 *
 * One board rather than two, because the track says "the Americas" and because
 * splitting them would make two boards that each need the participant threshold
 * G.6 exists to enforce. The day either half has enough players to stand alone,
 * splitting it is a mapping change and a migration of nothing: the column holds
 * a region, and this function decides which.
 */
const AMERICAS: readonly string[] = [
  'AG',
  'AI',
  'AR',
  'AW',
  'BB',
  'BL',
  'BM',
  'BO',
  'BQ',
  'BR',
  'BS',
  'BZ',
  'CA',
  'CL',
  'CO',
  'CR',
  'CU',
  'CW',
  'DM',
  'DO',
  'EC',
  'FK',
  'GD',
  'GF',
  'GL',
  'GP',
  'GT',
  'GY',
  'HN',
  'HT',
  'JM',
  'KN',
  'KY',
  'LC',
  'MF',
  'MQ',
  'MS',
  'MX',
  'NI',
  'PA',
  'PE',
  'PM',
  'PR',
  'PY',
  'SR',
  'SV',
  'SX',
  'TC',
  'TT',
  'US',
  'UY',
  'VC',
  'VE',
  'VG',
  'VI',
];

/**
 * The region a country code falls in.
 *
 * Case-insensitive, because a header is whatever the sender wrote. An empty
 * string, a malformed value and `XX` — which is what a CDN sends when it cannot
 * tell — all come out as `other`, so there is no input that has no answer.
 */
export function regionForCountry(code: string | null | undefined): PlayerRegion {
  if (code === null || code === undefined) return 'other';

  const upper = code.trim().toUpperCase();
  if (EUROPE.includes(upper)) return 'europe';
  if (AMERICAS.includes(upper)) return 'americas';
  return 'other';
}

/**
 * The region a player is ranked in: what they chose, else what was derived.
 *
 * **The choice wins, always**, which the track states and which is the whole
 * reason there are two columns rather than one with a flag. It is right for a
 * traveller — a header follows the network, not the person — and it is the
 * simplest answer to anybody who objects to the inference: the answer is that
 * they can set it, and their setting is the one that counts.
 *
 * Neither present is `other` rather than an error. A profile created before
 * this step has both null, and a player with no region is not a player without
 * a board — they are on the world one and on the one for everywhere else.
 */
export function effectiveRegion(profile: {
  readonly chosenRegion?: string | null;
  readonly derivedRegion?: string | null;
}): PlayerRegion {
  return asRegion(profile.chosenRegion) ?? asRegion(profile.derivedRegion) ?? 'other';
}

/** A stored string as a region, or null when it is not one of them. */
export function asRegion(value: string | null | undefined): PlayerRegion | null {
  return REGION_IDS.find((region) => region === value) ?? null;
}
