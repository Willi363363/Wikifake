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
  /** The dashboard's own labels, all of them already in the catalogue. */
  readonly board: string;
  readonly quests: string;
  readonly daily: string;
  readonly weekly: string;
  readonly streak: string;
  readonly finished: string;
  readonly average: string;
  readonly best: string;
  readonly coins: (count: number) => string;
  readonly progress: (done: number, target: number) => string;
  readonly reward: (count: number) => string;
  /** What a visitor sees instead of figures they do not have yet. */
  readonly keepTitle: string;
  readonly keepLead: string;
  readonly keepCta: string;
  readonly guest: string;
  /** The shop, for the page mockups. */
  readonly shopTitle: string;
  readonly shopLead: string;
  readonly buy: string;
  readonly wear: string;
  readonly worn: string;
  readonly takeOff: string;
  readonly tooDear: string;
  readonly earn: string;
  readonly price: (count: number) => string;
  readonly slot: (id: string) => string;
  readonly slotLead: (id: string) => string;
  readonly itemName: (id: string) => string;
  /** The quests, for the page mockups. */
  readonly questsLead: string;
  readonly claim: string;
  readonly claimed: string;
  readonly locked: string;
  readonly playRound: string;
  readonly rule: (id: string, target: number) => string;
}

export function useCopy(isAdmin: boolean): Copy {
  const home = useTranslations('home');
  const quests = useTranslations('quests');
  const shop = useTranslations('shop');
  const board = useTranslations('leaderboard');
  const admin = useTranslations('admin');
  const account = useTranslations('account');

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
    board: board('title'),
    quests: quests('title'),
    daily: quests('daily'),
    weekly: quests('weekly'),
    streak: account('profile.bestStreak'),
    finished: account('profile.gamesFinished'),
    average: account('profile.averageScore'),
    best: account('profile.bestScore'),
    coins: (count: number) => shop('balance', { count }),
    progress: (done: number, target: number) =>
      quests('progress', { progress: done, target }),
    reward: (count: number) => quests('reward', { count }),
    keepTitle: account('keepRound.title'),
    keepLead: account('keepRound.lead'),
    keepCta: account('keepRound.cta'),
    guest: account('playAsGuest'),
    shopTitle: shop('title'),
    shopLead: shop('lead'),
    buy: shop('buy'),
    wear: shop('wear'),
    worn: shop('worn'),
    takeOff: shop('takeOff'),
    tooDear: shop('tooDear'),
    earn: shop('earn'),
    price: (count: number) => shop('price', { count }),
    slot: (id: string) => shop(`slots.${id}` as 'slots.marker'),
    slotLead: (id: string) => shop(`slotLead.${id}` as 'slotLead.marker'),
    itemName: (id: string) => shop(`names.${id}` as 'names.MARKER_AMBER'),
    questsLead: quests('lead'),
    claim: quests('claim'),
    claimed: quests('claimed'),
    locked: quests('locked'),
    playRound: quests('play'),
    rule: (id: string, target: number) =>
      quests(`rules.${id}` as 'rules.DAILY_FINISH_ROUNDS', { target }),
    menu: home('nav.menu'),
    close: home('nav.close'),
    backToGame: home('nav.backToGame'),
    adminTitle: admin('title'),
  };
}
