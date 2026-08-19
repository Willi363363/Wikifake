/**
 * Pattern Match mini-game for the waiting screen.
 *
 * Shows a pattern of cells for ~2s, then asks the player to recall it.
 * Difficulty adapts: +1 cell on a perfect round, -1 on a miss (bounds 3–7).
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export function PatternMatch() {
  const [phase, setPhase] = useState("show");
  const [pattern, setPattern] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [results, setResults] = useState(null);
  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState(3);
  const timerRef = useRef(null);

  const startRound = useCallback(() => {
    const cells = new Set();
    while (cells.size < difficulty) cells.add(Math.floor(Math.random() * 16));
    setPattern([...cells]);
    setSelected(new Set());
    setResults(null);
    setPhase("show");
    timerRef.current = setTimeout(() => setPhase("recall"), 2200);
  }, [difficulty]);

  useEffect(() => {
    startRound();
    return () => clearTimeout(timerRef.current);
  }, [score, startRound]);

  const handleCellClick = (i) => {
    if (phase !== "recall") return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  useEffect(() => {
    if (phase === "recall" && selected.size === pattern.length && pattern.length > 0) {
      const patternSet = new Set(pattern);
      const correct = [...selected].every(s => patternSet.has(s));
      const resultMap = {};
      for (let i = 0; i < 16; i++) {
        if (selected.has(i) && patternSet.has(i)) resultMap[i] = "correct";
        else if (selected.has(i) && !patternSet.has(i)) resultMap[i] = "wrong";
        else if (!selected.has(i) && patternSet.has(i)) resultMap[i] = "missed";
      }
      setResults(resultMap);
      setPhase("result");
      setDifficulty(d => correct ? Math.min(7, d + 1) : Math.max(3, d - 1));
      setTimeout(() => setScore(s => s + 1), 1600);
    }
  }, [selected, phase, pattern]);

  const getCellClass = (i) => {
    if (phase === "show" && pattern.includes(i)) return "highlighted locked";
    if (phase === "result" && results) {
      if (results[i] === "correct") return "correct locked";
      if (results[i] === "wrong") return "wrong locked";
      if (results[i] === "missed") return "highlighted locked";
      return "locked";
    }
    if (phase === "recall" && selected.has(i)) return "selected";
    if (phase === "show") return "locked";
    return "";
  };

  return (
    <div>
      <div className="pattern-grid">
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} className={`pattern-cell ${getCellClass(i)}`} onClick={() => handleCellClick(i)} />
        ))}
      </div>
      <div className="pattern-info">
        {phase === "show" ? "Memorize the pattern…" : phase === "recall" ? `Select ${pattern.length} cells` : results && Object.values(results).every(v => v === "correct") ? "Perfect! ✓" : "Not quite — try again"}
      </div>
      <div className="pattern-score">Level {difficulty - 2} · Round {score + 1}</div>
    </div>
  );
}
