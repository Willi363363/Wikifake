/**
 * Ecran d'attente pendant la generation de l'article.
 *
 * Ne fait plus AUCUN appel reseau et n'expose plus de callback global
 * (`window.__waitingScreenReady`) : il affiche une progression et un
 * lanceur de mini-jeux, c'est tout. Le parent decide quand passer a la suite.
 */

import { useEffect, useRef, useState } from 'react';

import BackgroundAnimation from './BackgroundAnimation';
import GameLauncher from './GameLauncher';
import ProgressTracker from './ProgressTracker';
import { findMinigame } from './minigames';

/** Progression simulee : approche 85 % puis attend le signal `ready`. */
function useSimulatedProgress(ready) {
  const [progress, setProgress] = useState(0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (ready) {
      setProgress(100);
      return undefined;
    }
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const target = Math.min(85, (elapsed / 10000) * 85);
      const eased = 85 * (1 - Math.pow(1 - target / 85, 2.5));
      setProgress((prev) => Math.max(prev, eased));
    }, 200);
    return () => clearInterval(id);
  }, [ready]);

  return progress;
}

function WaitingScreen({ topic, ready = false, fadingOut = false, players, roomCode }) {
  const progress = useSimulatedProgress(ready);
  const [launcher, setLauncher] = useState('closed'); // closed | selector | <id>
  const activeGame = findMinigame(launcher);

  return (
    <div className={`waiting-container${fadingOut ? ' fade-out' : ''}`}>
      {launcher === 'closed' && <BackgroundAnimation />}

      <div className="waiting-card">
        <div className="waiting-header">
          <div className="waiting-logo">
            <img src="/image.png" alt="" />
          </div>
          <div>
            <div className="waiting-title">WikiFake</div>
            <div className="waiting-topic">{topic}</div>
          </div>
        </div>

        <ProgressTracker progress={progress} />

        {launcher === 'closed' && (
          <div className="launcher-idle">
            <button
              type="button"
              className="launcher-toggle-btn"
              onClick={() => setLauncher('selector')}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path
                  d="M2 3.5h10M2 7h10M2 10.5h10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Jouer en attendant
            </button>
          </div>
        )}

        {launcher === 'selector' && (
          <div className="game-launcher-container">
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                className="launcher-toggle-btn expanded"
                onClick={() => setLauncher('closed')}
              >
                Fermer
              </button>
            </div>
            <GameLauncher onSelect={setLauncher} />
          </div>
        )}

        {activeGame && (
          <div className="active-game-container">
            <button
              type="button"
              className="back-to-launcher"
              onClick={() => setLauncher('selector')}
            >
              ← Retour aux jeux
            </button>
            <div className="active-game-title">
              <span aria-hidden="true">{activeGame.icon}</span>
              <span>{activeGame.name}</span>
            </div>
            <activeGame.component />
          </div>
        )}

        {players?.length > 0 && (
          <div className="waiting-players">
            <span className="label-mono">Joueurs</span>
            {players.map((player) => (
              <span key={player.name} className="waiting-player-chip">
                <span className="waiting-player-avatar">
                  {player.name.slice(0, 1).toUpperCase()}
                </span>
                {player.name}
              </span>
            ))}
            {roomCode && <span className="label-mono room-code">Salle {roomCode}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default WaitingScreen;
