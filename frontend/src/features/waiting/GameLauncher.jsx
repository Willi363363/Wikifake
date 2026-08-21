/** Grille de selection d'un mini-jeu. */

import { MINIGAMES } from './minigames';

function GameLauncher({ onSelect }) {
  return (
    <div className="launcher-grid">
      {MINIGAMES.map((game) => (
        <button
          key={game.id}
          type="button"
          className="game-card"
          onClick={() => onSelect(game.id)}
        >
          <span className="game-icon">{game.icon}</span>
          <span className="game-card-title">{game.name}</span>
        </button>
      ))}
    </div>
  );
}

export default GameLauncher;
