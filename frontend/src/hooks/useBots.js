import { useState, useEffect } from 'react';

// ============ Bots simulation ============
const BOT_PROFILES = {
  alice: { tp: 6, fp: 1, hintsUsed: 1, timeBonus: 72 },   // strong solver
  morgan: { tp: 5, fp: 2, hintsUsed: 0, timeBonus: 54 },   // fast but reckless
  noor: { tp: 4, fp: 0, hintsUsed: 2, timeBonus: 88 },   // careful, leans on hints
};

export function useBots(playing, totalFakes) {
  const [bots, setBots] = useState([
    { id: "alice", name: "Alice", color: "#c4548a", score: 0, x: 320, y: 600 },
    { id: "morgan", name: "Morgan", color: "#7a9460", score: 0, x: 540, y: 820 },
    { id: "noor", name: "Noor", color: "#d68842", score: 0, x: 200, y: 900 },
  ]);

  useEffect(() => {
    if (!playing) return;
    const moveInt = setInterval(() => {
      setBots(prev => prev.map(b => {
        const dx = (Math.random() - 0.5) * 240;
        const dy = (Math.random() - 0.5) * 280;
        return {
          ...b,
          x: Math.max(80, Math.min(720, b.x + dx)),
          y: Math.max(400, Math.min(1600, b.y + dy)),
        };
      }));
    }, 2200);
    const scoreInt = setInterval(() => {
      setBots(prev => prev.map(b => {
        const advance = Math.random() < 0.35 ? 1 : 0;
        return {
          ...b,
          score: b.score + (advance ? Math.floor(80 + Math.random() * 70) : Math.floor(Math.random() * 6)),
        };
      }));
    }, 2400);
    return () => { clearInterval(moveInt); clearInterval(scoreInt); };
  }, [playing, totalFakes]);

  return bots;
}
