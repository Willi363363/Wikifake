'use client';

// The audit, on the rendering rather than on the stylesheet.
//
// `contrast.test.ts` measures the same pairs by parsing `theme.css`, which is
// what CI can do without a browser. This measures them by asking the browser
// what it actually painted — `getComputedStyle` resolves `var(--color-…)` for
// the element it is asked about, so the same component inside `.dark` answers
// with the dark palette and no second implementation is needed.
//
// The maths is `@wikifake/ui`'s, tested there. What is here is where the colours
// come from.
import { auditContrast, cn, Badge } from '@wikifake/ui';
import type { ContrastResult } from '@wikifake/ui';
import { useEffect, useRef, useState } from 'react';

const TONE = { AA: 'green', large: 'warn', fail: 'danger' } as const;

export function ContrastAudit() {
  const ground = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<readonly ContrastResult[] | null>(null);

  useEffect(() => {
    const element = ground.current;
    if (element === null) return;

    // After paint, and from the element itself: a token read off `:root` would
    // give the light value even inside `.dark`, which is the whole thing this
    // is trying to check.
    const style = globalThis.getComputedStyle(element);
    setResults(auditContrast((token) => style.getPropertyValue(`--color-${token}`)));
  }, []);

  return (
    <div ref={ground} className="rounded-xl border border-line bg-bg p-6 text-ink">
      {results === null ? (
        <p className="text-sm text-muted">Measuring…</p>
      ) : (
        <ul className="space-y-1">
          {results.map((result) => (
            <li
              key={`${result.fg}-${result.bg}`}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line py-1.5 last:border-0"
            >
              <span className="min-w-0">
                <code className="text-xs text-ink">
                  {result.fg} on {result.bg}
                </code>
                <span className="block text-xs text-muted">{result.use}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    'font-mono text-xs tabular-nums',
                    result.passes ? 'text-ink-2' : 'text-danger',
                  )}
                >
                  {result.ratio.toFixed(2)}:1
                </span>
                <Badge tone={TONE[result.grade]}>{result.grade}</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
