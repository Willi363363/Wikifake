/** Course d'obstacles. */

import { useState, useEffect, useRef, useCallback } from 'react';

function DinoGame() {
  const [isJumping, setIsJumping] = useState(false);
  const [obstacleX, setObstacleX] = useState(320);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const jumpHeight = useRef(0);
  const obstacleRef = useRef(320);
  const scoreRef = useRef(0);

  const resetGame = (e) => {
    e.stopPropagation();
    setIsJumping(false);
    setObstacleX(320);
    setGameOver(false);
    setScore(0);
    jumpHeight.current = 0;
    obstacleRef.current = 320;
    scoreRef.current = 0;
  };

  const jump = useCallback(() => {
    if (!isJumping && !gameOver) {
      setIsJumping(true);
      let up = true;
      const jumpInterval = setInterval(() => {
        if (up) {
          jumpHeight.current += 5;
          if (jumpHeight.current >= 60) up = false;
        } else {
          jumpHeight.current -= 5;
          if (jumpHeight.current <= 0) {
            jumpHeight.current = 0;
            clearInterval(jumpInterval);
            setIsJumping(false);
          }
        }
      }, 20);
    }
  }, [isJumping, gameOver]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.code === 'Space' || e.code === 'ArrowUp') && !gameOver) {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jump, gameOver]);

  useEffect(() => {
    if (gameOver) return;
    let speed = 4;
    const gameLoop = setInterval(() => {
      obstacleRef.current -= speed;
      if (obstacleRef.current < -20) {
        obstacleRef.current = 320 + Math.random() * 100;
        scoreRef.current += 100;
        setScore(scoreRef.current);
        speed += 0.2;
      }
      setObstacleX(obstacleRef.current);

      // Collision detection
      // Player is at x: 30 to 50, y: jumpHeight to jumpHeight + 20
      // Obstacle is at x: obstacleX to obstacleX + 12, y: 0 to 24
      if (obstacleRef.current < 50 && obstacleRef.current + 12 > 30) {
        if (jumpHeight.current < 24) {
          setGameOver(true);
        }
      }
    }, 20);
    return () => clearInterval(gameLoop);
  }, [gameOver]);

  return (
    <div>
      <div className="dino-board" onClick={jump}>
        {gameOver && (
          <div className="snake-overlay">
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24 }}>Game Over</div>
            <button className="back-to-launcher" onClick={resetGame} style={{ marginTop: 12 }}>Restart</button>
          </div>
        )}
        <div className="dino-ground" />
        <div className="dino-player" style={{ bottom: 22 + jumpHeight.current }} />
        <div className="dino-obstacle" style={{ left: obstacleX }} />
      </div>
      <div className="pattern-score" style={{ marginTop: 12 }}>Score: {score}</div>
      <div className="pattern-info" style={{ fontSize: 11 }}>Click, Space, or Up to jump</div>
    </div>
  );
}


// ============ GAME LAUNCHER ============

export default DinoGame;
