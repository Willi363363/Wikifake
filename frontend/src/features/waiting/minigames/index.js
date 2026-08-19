/**
 * Barrel for the waiting-screen mini-games.
 *
 * Also exports the GAMES registry the launcher iterates over — order, ids,
 * names and icons must stay stable because game ids double as launcher state.
 */
import { TicTacToe } from './TicTacToe.jsx';
import { ReactionSpeed } from './ReactionSpeed.jsx';
import { MemoryCards } from './MemoryCards.jsx';
import { PatternMatch } from './PatternMatch.jsx';
import { Snake } from './Snake.jsx';
import { DinoRun } from './DinoRun.jsx';

export { TicTacToe, ReactionSpeed, MemoryCards, PatternMatch, Snake, DinoRun };

export const GAMES = [
  { id: "ttt", name: "Tic-Tac-Toe", icon: "✕", component: TicTacToe },
  { id: "reaction", name: "Reaction Speed", icon: "⚡", component: ReactionSpeed },
  { id: "memory", name: "Memory Cards", icon: "◆", component: MemoryCards },
  { id: "pattern", name: "Pattern Match", icon: "◧", component: PatternMatch },
  { id: "snake", name: "Snake", icon: "🐍", component: Snake },
  { id: "dino", name: "Agent Dash", icon: "🦖", component: DinoRun },
];
