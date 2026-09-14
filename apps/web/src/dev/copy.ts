'use client';

// The words the candidates draw, read from the catalogue — step L.1.
//
// One hook, so three candidates cannot drift onto three different sentences.
// Everything here already exists: the hero is the landing's own copy, and the
// destination labels are the titles those pages already carry. A mockup written
// on new prose is a mockup that proves nothing about the real one.
import { useTranslations } from 'next-intl';

import { destinationsFor, type Destination } from './destinations.js';

export interface Entry {
  readonly route: string;
  readonly label: string;
}

export interface Beat {
  readonly title: string;
  readonly body: string;
}

export interface Copy {
  readonly brand: string;
  readonly question: string;
  readonly description: string;
  readonly play: string;
  readonly noAccount: string;
  readonly beats: readonly Beat[];
  readonly entries: readonly Entry[];
  readonly menu: string;
  readonly close: string;
  readonly backToGame: string;
  readonly adminTitle: string;
}

export function useCopy(isAdmin: boolean): Copy {
  const home = useTranslations('home');
  const quests = useTranslations('quests');
  const shop = useTranslations('shop');
  const board = useTranslations('leaderboard');
  const admin = useTranslations('admin');

  const label = (one: Destination): string => {
    if (one.zone === 'quests') return quests('title');
    if (one.zone === 'shop') return shop('title');
    if (one.zone === 'leaderboard') return board('title');
    if (one.zone === 'admin') return admin('title');
    return home(one.key as 'play');
  };

  return {
    brand: home('title'),
    question: home('question'),
    description: home('description'),
    play: home('play'),
    noAccount: home('noAccount'),
    beats: (['source', 'collision', 'score'] as const).map((beat) => ({
      title: home(`beats.${beat}.title`),
      body: home(`beats.${beat}.body`),
    })),
    entries: destinationsFor(isAdmin).map((one) => ({
      route: one.route,
      label: label(one),
    })),
    menu: home('nav.menu'),
    close: home('nav.close'),
    backToGame: home('nav.backToGame'),
    adminTitle: admin('title'),
  };
}
