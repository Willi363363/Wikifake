'use client';

// The six games, in one list.
//
// Ids are stable because they are the launcher's state, and because a link to a
// game is a thing somebody will eventually want. Order is the current game's:
// the two that need no explanation first, the two arcade ones last.
//
// Since step 11.2 the names live in the catalogue (`messages/<locale>/waiting.json`,
// under `games.<id>.name`): the id doubles as the catalogue key, and this module
// keeps only what is not copy — the id, the glyph, and the component.
import type { ComponentType } from 'react';

import { DinoRun } from './dino-run.js';
import { MemoryCards } from './memory-cards.js';
import { PatternMatch } from './pattern-match.js';
import { ReactionSpeed } from './reaction-speed.js';
import { Snake } from './snake.js';
import { TicTacToe } from './tic-tac-toe.js';

/** The ids, as a type: what lets `games.${id}.name` be a checked key. */
export type MinigameId = 'ttt' | 'reaction' | 'memory' | 'pattern' | 'snake' | 'dino';

export interface Minigame {
  /** Stable: it is what the launcher remembers, never shown or translated. */
  readonly id: MinigameId;
  /** A glyph. The launcher grid is text, so nothing here is an image. */
  readonly icon: string;
  readonly Play: ComponentType;
}

export const MINIGAMES: readonly Minigame[] = [
  { id: 'ttt', icon: '✕', Play: TicTacToe },
  { id: 'reaction', icon: '⚡', Play: ReactionSpeed },
  { id: 'memory', icon: '◆', Play: MemoryCards },
  { id: 'pattern', icon: '◧', Play: PatternMatch },
  { id: 'snake', icon: '🐍', Play: Snake },
  { id: 'dino', icon: '🦖', Play: DinoRun },
];

export function minigameById(id: string): Minigame | undefined {
  return MINIGAMES.find((game) => game.id === id);
}
