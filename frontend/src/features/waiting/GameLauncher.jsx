/**
 * Mini-game selector grid shown while a round loads.
 *
 * Reports the chosen game id back to the waiting screen, which uses it as
 * its launcher state.
 */
import { GAMES } from './minigames';

export function GameLauncher({ onSelectGame }) {
  return (
    <div className="launcher-grid">
      {GAMES.map(game => (
        <div key={game.id} className="game-card" onClick={() => onSelectGame(game.id)}>
          <div className="game-icon">{game.icon}</div>
          <div className="game-card-title">{game.name}</div>
        </div>
      ))}
    </div>
  );
}
