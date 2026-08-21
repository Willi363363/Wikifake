/** Morpion jouable pendant le chargement. */

import { useState, useEffect, useRef, useCallback } from 'react';

const TTT_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function checkWinner(board) {
  for (const line of TTT_LINES) {
    const [a,b,c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return board.every(c => c !== null) ? { winner: "draw", line: null } : null;
}

function TicTacToe() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [result, setResult] = useState(null);
  const [winLine, setWinLine] = useState(null);
  const [score, setScore] = useState({ wins: 0, draws: 0, losses: 0 });
  const aiTimeout = useRef(null);

  const resetGame = useCallback(() => {
    setBoard(Array(9).fill(null));
    setXIsNext(true);
    setResult(null);
    setWinLine(null);
  }, []);

  useEffect(() => {
    if (!xIsNext && !result) {
      aiTimeout.current = setTimeout(() => {
        setBoard(prev => {
          const empty = prev.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
          if (empty.length === 0) return prev;
          const tryWin = (mark) => {
            for (const line of TTT_LINES) {
              const vals = line.map(i => prev[i]);
              const markCount = vals.filter(v => v === mark).length;
              const nullCount = vals.filter(v => v === null).length;
              if (markCount === 2 && nullCount === 1) return line[vals.indexOf(null)];
            }
            return -1;
          };
          let move = tryWin("O");
          if (move === -1) move = tryWin("X");
          if (move === -1 && prev[4] === null) move = 4;
          if (move === -1) move = empty[Math.floor(Math.random() * empty.length)];
          const next = [...prev];
          next[move] = "O";
          return next;
        });
        setXIsNext(true);
      }, 400 + Math.random() * 300);
    }
    return () => clearTimeout(aiTimeout.current);
  }, [xIsNext, result]);

  useEffect(() => {
    const res = checkWinner(board);
    if (res) {
      setResult(res.winner);
      setWinLine(res.line);
      if (res.winner === "X") setScore(s => ({ ...s, wins: s.wins + 1 }));
      else if (res.winner === "O") setScore(s => ({ ...s, losses: s.losses + 1 }));
      else setScore(s => ({ ...s, draws: s.draws + 1 }));
      setTimeout(resetGame, 1800);
    }
  }, [board, resetGame]);

  const handleClick = (i) => {
    if (board[i] || !xIsNext || result) return;
    const next = [...board];
    next[i] = "X";
    setBoard(next);
    setXIsNext(false);
  };

  const statusText = result === "X" ? "You win! ✓"
    : result === "O" ? "AI wins"
    : result === "draw" ? "Draw"
    : xIsNext ? "Your turn" : "AI thinking…";

  return (
    <div>
      <div className="ttt-grid">
        {board.map((cell, i) => (
          <div
            key={i}
            className={`ttt-cell${cell ? " taken" : ""}${winLine && winLine.includes(i) ? " win-cell" : ""}`}
            onClick={() => handleClick(i)}
          >
            {cell === "X" && <span className="x-mark">✕</span>}
            {cell === "O" && <span className="o-mark">○</span>}
          </div>
        ))}
      </div>
      <div className="ttt-status">{statusText}</div>
      <div className="ttt-score">
        <span>W {score.wins}</span>
        <span>D {score.draws}</span>
        <span>L {score.losses}</span>
      </div>
    </div>
  );
}

// 2. REACTION SPEED

export default TicTacToe;
