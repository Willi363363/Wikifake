/**
 * Registre des mini-jeux jouables pendant la generation de l'article.
 *
 * Ajouter un jeu = creer un fichier dans ce dossier et ajouter une ligne
 * ici. Rien d'autre a modifier.
 */

import DinoGame from './DinoGame';
import MemoryCards from './MemoryCards';
import PatternMatch from './PatternMatch';
import ReactionSpeed from './ReactionSpeed';
import SnakeGame from './SnakeGame';
import TicTacToe from './TicTacToe';

export const MINIGAMES = [
  { id: 'ttt', name: 'Morpion', icon: '✕', component: TicTacToe },
  { id: 'reaction', name: 'Réflexes', icon: '⚡', component: ReactionSpeed },
  { id: 'memory', name: 'Mémoire', icon: '◆', component: MemoryCards },
  { id: 'pattern', name: 'Motifs', icon: '◧', component: PatternMatch },
  { id: 'snake', name: 'Snake', icon: '🐍', component: SnakeGame },
  { id: 'dino', name: 'Course', icon: '🦖', component: DinoGame },
];

export function findMinigame(id) {
  return MINIGAMES.find((game) => game.id === id) ?? null;
}
