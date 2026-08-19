/**
 * Decorative "data stream" background for the waiting screen.
 *
 * 15 falling lines with randomized geometry/timing, memoized once per mount
 * so they do not re-randomize on every render.
 */
import { useMemo } from 'react';

export function BackgroundAnimation() {
  const lines = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      width: `${1 + Math.random() * 2}px`,
      height: `${20 + Math.random() * 60}px`,
      duration: `${3 + Math.random() * 4}s`,
      delay: `${Math.random() * -5}s`,
      opacity: 0.3 + Math.random() * 0.7,
    }));
  }, []);

  return (
    <div className="data-stream-animation">
      {lines.map(line => (
        <div
          key={line.id}
          className="ds-line"
          style={{
            left: line.left,
            width: line.width,
            height: line.height,
            animationDuration: line.duration,
            animationDelay: line.delay,
            opacity: line.opacity,
          }}
        />
      ))}
    </div>
  );
}
