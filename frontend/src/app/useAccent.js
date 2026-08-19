/**
 * Applies the selected accent palette to the document as CSS custom properties.
 *
 * Accent lives in JS (the tweak panel changes it) but is consumed by the
 * stylesheets, so it has to be pushed onto :root rather than passed as props.
 */
import { useEffect } from 'react';
import { ACCENTS, DEFAULT_ACCENT } from '../config.js';

export function useAccent(name) {
  useEffect(() => {
    const accent = ACCENTS[name] || ACCENTS[DEFAULT_ACCENT];
    const root = document.documentElement.style;
    root.setProperty('--accent', accent.primary);
    root.setProperty('--accent-soft', accent.soft);
    root.setProperty('--accent-line', accent.line);
  }, [name]);
}

/** The primary colour of an accent, for the places that need it in JS. */
export function accentColor(name) {
  return (ACCENTS[name] || ACCENTS[DEFAULT_ACCENT]).primary;
}
