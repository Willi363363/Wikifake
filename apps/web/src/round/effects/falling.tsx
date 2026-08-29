'use client';

// The two that rain: the blizzard of `FREEZE_TIME` and the confetti of
// `CONFETTI`.
//
// Both fall on `snowfall`, which is one of the keyframes the stylesheet switches
// off under `prefers-reduced-motion` — so under that preference there are no
// particles at all rather than a hundred and twenty of them piled motionless at
// the top of the screen. The wash and the number stay: what happened is still
// said.
import { FREEZE_TIME_SECONDS } from '@wikifake/domain';
import { useTranslations } from 'next-intl';

import { CONFETTI, SNOW, useParticles, type Particle } from './particles.js';
import { Sheet } from './screen.js';
import { usePrefersReducedMotion } from '../reduced-motion.js';

/** The colours of a confetti piece. Decorative, so not theme tokens. */
const PAPER = ['#ff4d6d', '#ffd166', '#06d6a0', '#118ab2', '#a64ac9', '#ff9a3c'];

/**
 * The custom property the `snowfall` keyframe reads for its horizontal travel.
 *
 * A CSS variable rather than a per-particle keyframe: a hundred and twenty
 * generated `@keyframes` rules is a hundred and twenty stylesheet insertions.
 */
function driftOf(particle: Particle): Record<string, string> {
  return { '--drift': `${String(particle.drift)}px` };
}

export function Blizzard() {
  const t = useTranslations('round');
  const still = usePrefersReducedMotion();
  const flakes = useParticles(SNOW, still);

  return (
    <Sheet
      // The number is `FREEZE_TIME_SECONDS`'s, injected: a sheet that spells
      // out "ten" is a sheet a balance change turns into a lie.
      label={t('effects.blizzard.aria', { seconds: FREEZE_TIME_SECONDS })}
      className="bg-accent/15"
    >
      <div className="absolute inset-0 animate-frost-pulse bg-[radial-gradient(ellipse_at_center,transparent_15%,var(--color-accent)_130%)] opacity-30" />

      {flakes.map((flake) => (
        <span
          key={flake.id}
          aria-hidden="true"
          className="absolute -top-8 animate-snowfall text-accent"
          style={{
            left: `${String(flake.left)}%`,
            fontSize: `${String(flake.size)}px`,
            opacity: flake.opacity,
            animationDuration: `${String(flake.duration)}s`,
            animationDelay: `${String(flake.delay)}s`,
            ...driftOf(flake),
          }}
        >
          ❄
        </span>
      ))}

      <p className="absolute inset-0 flex items-center justify-center font-mono text-7xl font-black text-accent">
        {t('effects.blizzard.amount', { seconds: FREEZE_TIME_SECONDS })}
      </p>
    </Sheet>
  );
}

export function Confetti() {
  const t = useTranslations('round');
  const still = usePrefersReducedMotion();
  const pieces = useParticles(CONFETTI, still);

  return (
    <Sheet label={t('effects.confetti.aria')} className="bg-transparent">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          aria-hidden="true"
          className="absolute -top-8 animate-snowfall"
          style={{
            left: `${String(piece.left)}%`,
            width: piece.variant === 1 ? piece.size * 1.6 : piece.size,
            height: piece.size,
            background: PAPER[piece.id % PAPER.length],
            borderRadius: piece.variant === 0 ? '50%' : '2px',
            opacity: piece.opacity,
            animationDuration: `${String(piece.duration)}s`,
            animationDelay: `${String(piece.delay)}s`,
            ...driftOf(piece),
          }}
        />
      ))}
    </Sheet>
  );
}
