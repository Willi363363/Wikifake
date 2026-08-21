/** Snake. */

import { useState, useEffect, useRef } from 'react';

function SnakeGame() {
  const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
  const [dir, setDir] = useState({ x: 1, y: 0 });
  const [food, setFood] = useState({ x: 15, y: 15 });
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const boardRef = useRef(null);

  const resetGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setDir({ x: 1, y: 0 });
    setFood({ x: Math.floor(Math.random() * 24), y: Math.floor(Math.random() * 24) });
    setGameOver(false);
    setScore(0);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      switch(e.key) {
        case 'ArrowUp': case 'w': if (dir.y === 0) setDir({ x: 0, y: -1 }); break;
        case 'ArrowDown': case 's': if (dir.y === 0) setDir({ x: 0, y: 1 }); break;
        case 'ArrowLeft': case 'a': if (dir.x === 0) setDir({ x: -1, y: 0 }); break;
        case 'ArrowRight': case 'd': if (dir.x === 0) setDir({ x: 1, y: 0 }); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dir]);

  useEffect(() => {
    if (gameOver) return;
    const speed = Math.max(60, 150 - score * 5);
    const interval = setInterval(() => {
      setSnake(prev => {
        const head = { x: prev[0].x + dir.x, y: prev[0].y + dir.y };
        if (head.x < 0 || head.x >= 24 || head.y < 0 || head.y >= 24 || prev.some(seg => seg.x === head.x && seg.y === head.y)) {
          setGameOver(true);
          return prev;
        }
        const newSnake = [head, ...prev];
        if (head.x === food.x && head.y === food.y) {
          setScore(s => s + 1);
          setFood({ x: Math.floor(Math.random() * 24), y: Math.floor(Math.random() * 24) });
        } else {
          newSnake.pop();
        }
        return newSnake;
      });
    }, speed);
    return () => clearInterval(interval);
  }, [dir, food, gameOver, score]);

  return (
    <div>
      <div className="snake-board" ref={boardRef}>
        {gameOver && (
          <div className="snake-overlay">
            <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24 }}>Game Over</div>
            <button className="back-to-launcher" onClick={resetGame} style={{ marginTop: 12 }}>Restart</button>
          </div>
        )}
        <div className="snake-food" style={{ left: food.x * 10, top: food.y * 10 }} />
        {snake.map((seg, i) => (
          <div key={i} className="snake-cell" style={{ left: seg.x * 10, top: seg.y * 10 }} />
        ))}
      </div>
      <div className="pattern-score" style={{ marginTop: 12 }}>Score: {score}</div>
      <div className="pattern-info" style={{ fontSize: 11 }}>Use WASD or Arrows to move</div>
    </div>
  );
}

// 6. DINO RUN

export default SnakeGame;
