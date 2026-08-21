/** Jeu de memoire. */

import { useState, useEffect, useRef, useCallback } from 'react';

const MEMORY_ICONS = ["◆", "●", "▲", "★", "♦", "♠", "♥", "♣"];

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function MemoryCards() {
  const makeCards = () => {
    const icons = MEMORY_ICONS.slice(0, 4);
    return shuffleArray([...icons, ...icons].map((icon, i) => ({ id: i, icon, matched: false })));
  };
  const [cards, setCards] = useState(makeCards);
  const [flipped, setFlipped] = useState([]);
  const [moves, setMoves] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const lockRef = useRef(false);

  const resetGame = useCallback(() => {
    setCards(makeCards());
    setFlipped([]);
    setMoves(0);
    setMatchCount(0);
    lockRef.current = false;
  }, []);

  const handleFlip = (idx) => {
    if (lockRef.current || flipped.includes(idx) || cards[idx].matched || flipped.length >= 2) return;
    const next = [...flipped, idx];
    setFlipped(next);

    if (next.length === 2) {
      setMoves(m => m + 1);
      lockRef.current = true;
      if (cards[next[0]].icon === cards[next[1]].icon) {
        setTimeout(() => {
          setCards(prev => prev.map((c, i) => i === next[0] || i === next[1] ? { ...c, matched: true } : c));
          setFlipped([]);
          setMatchCount(mc => mc + 1);
          lockRef.current = false;
        }, 500);
      } else {
        setTimeout(() => {
          setFlipped([]);
          lockRef.current = false;
        }, 900);
      }
    }
  };

  useEffect(() => {
    if (matchCount === 4) setTimeout(resetGame, 1600);
  }, [matchCount, resetGame]);

  return (
    <div>
      <div className="memory-grid">
        {cards.map((card, i) => (
          <div key={card.id} className={`memory-card${flipped.includes(i) ? " flipped" : ""}${card.matched ? " matched" : ""}`} onClick={() => handleFlip(i)}>
            <div className="memory-card-inner">
              <div className="memory-card-face memory-card-front" />
              <div className="memory-card-face memory-card-back">{card.icon}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="memory-status">{matchCount === 4 ? "All matched! ✓" : `${matchCount}/4 pairs`}</div>
      <div className="memory-moves">{moves} moves</div>
    </div>
  );
}

// 4. PATTERN MATCH

export default MemoryCards;
