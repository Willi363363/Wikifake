'use client';

// The sheets that simply cover the screen: fog, the quake, the redaction.
//
// One component each in the current game, ninety lines apiece of inline style.
// What differs between them is a wash and a word, so what differs here is a
// wash and a word.
import { cn } from '@wikifake/ui';
import type { ReactNode } from 'react';

export interface SheetProps {
  /** What it is, for anyone who cannot see it. */
  readonly label: string;
  readonly className: string;
  readonly children?: ReactNode;
}

/**
 * A full-screen sheet.
 *
 * `pointer-events-none` on all of them: an effect that makes the article hard to
 * read is not an effect that stops the player marking a paragraph. The current
 * blur does both — `pointerEvents: 'none'` on the card — which turns a five-
 * second nuisance into five seconds of not playing.
 */
export function Sheet({ label, className, children }: SheetProps) {
  return (
    <div
      // Announced once, politely. A player who cannot see the fog still wants to
      // know why the article has gone quiet.
      role="status"
      aria-label={label}
      className={cn('pointer-events-none fixed inset-0 z-40 overflow-hidden', className)}
    >
      {children}
    </div>
  );
}

/** BLUR — a wash over the page, with the card blurred underneath it. */
export function Fog() {
  return (
    <Sheet
      label="Someone has fogged your screen"
      className="bg-ink/25 backdrop-blur-[2px]"
    >
      <div className="absolute inset-0 animate-fog-drift bg-[radial-gradient(ellipse_at_center,transparent_10%,var(--color-ink)_140%)] opacity-40" />
    </Sheet>
  );
}

/** EARTHQUAKE — the shake is on the article; this is the dust. */
export function Quake() {
  return (
    <Sheet label="Someone is shaking your screen" className="bg-bronze/10">
      <div className="absolute inset-0 shadow-[inset_0_0_120px_color-mix(in_srgb,var(--color-bronze)_45%,transparent)]" />
    </Sheet>
  );
}

/** BLACKOUT — the redaction. */
export function Blackout() {
  return (
    <Sheet label="Someone has redacted your article" className="bg-ink/80">
      <p className="absolute inset-0 flex items-center justify-center font-mono text-sm tracking-[0.3em] text-bg uppercase">
        redacted
      </p>
    </Sheet>
  );
}

/**
 * SCORE_STEAL — the bolt.
 *
 * `animate-screen-flash` is one of the three the stylesheet switches off under
 * `prefers-reduced-motion`: at 0.45s infinite with two peaks a cycle it is about
 * 4.4 flashes a second, against a threshold of three. Switched off it is a
 * still wash, which still says what happened.
 */
export function Lightning() {
  return (
    <Sheet label="Someone has taken points from you" className="bg-danger/20">
      <div className="absolute inset-0 animate-screen-flash bg-danger/30" />
      <p className="absolute inset-0 flex items-center justify-center font-mono text-6xl font-black text-danger">
        −50
      </p>
    </Sheet>
  );
}
