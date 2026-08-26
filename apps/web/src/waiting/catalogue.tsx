'use client';

// The six games, in one list.
//
// Ids are stable because they are the launcher's state, and because a link to a
// game is a thing somebody will eventually want. Order is the current game's:
// the two that need no explanation first, the two arcade ones last.
import type { ComponentType } from 'react';

import { DinoRun } from './dino-run.js';
import { MemoryCards } from './memory-cards.js';
import { PatternMatch } from './pattern-match.js';
import { ReactionSpeed } from './reaction-speed.js';
import { Snake } from './snake.js';
import { TicTacToe } from './tic-tac-toe.js';

export interface Minigame {
  /** Stable: it is what the launcher remembers. */
  readonly id: string;
  readonly name: string;
  /** A glyph. The launcher grid is text, so nothing here is an image. */
  readonly icon: string;
  readonly Play: ComponentType;
}

export const MINIGAMES: readonly Minigame[] = [
  { id: 'ttt', name: 'Tic-Tac-Toe', icon: '✕', Play: TicTacToe },
  { id: 'reaction', name: 'Reaction Speed', icon: '⚡', Play: ReactionSpeed },
  { id: 'memory', name: 'Memory Cards', icon: '◆', Play: MemoryCards },
  { id: 'pattern', name: 'Pattern Match', icon: '◧', Play: PatternMatch },
  { id: 'snake', name: 'Snake', icon: '🐍', Play: Snake },
  { id: 'dino', name: 'Agent Dash', icon: '🦖', Play: DinoRun },
];

export function minigameById(id: string): Minigame | undefined {
  return MINIGAMES.find((game) => game.id === id);
}
