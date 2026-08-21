/**
 * Moteur audio (Web Audio API).
 *
 * Le contexte est cree paresseusement au premier son, apres une interaction
 * utilisateur, et l'ensemble est coupable via `setMuted` (preference
 * persistee par `state/SettingsContext`).
 */

const STORAGE_KEY = 'wikifake.muted';

let ctx = null;
let muted = localStorage.getItem(STORAGE_KEY) === '1';

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = Boolean(value);
  localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
}

function context() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, type, duration, volume = 0.1, delay = 0) {
  if (muted) return;
  const audio = context();
  if (!audio) return;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration);
}

/**
 * Table des sons. Ajouter un son = ajouter une entree ici, rien d'autre.
 * Chaque entree est une liste de notes `[freq, type, duree, volume, retard]`.
 */
const SOUNDS = {
  click_on: [[600, 'sine', 0.05, 0.05]],
  click_off: [[400, 'sine', 0.05, 0.05]],
  success: [
    [440, 'sine', 0.1, 0.08],
    [554.37, 'sine', 0.2, 0.08, 0.08],
  ],
  game_over: [[150, 'sawtooth', 0.3, 0.1]],
  hint: [[880, 'sine', 0.15, 0.05]],
  item_receive: [
    [523.25, 'sine', 0.1, 0.06],
    [659.25, 'sine', 0.2, 0.06, 0.1],
  ],
  item_use: [
    [300, 'triangle', 0.2, 0.08],
    [200, 'triangle', 0.2, 0.08, 0.1],
  ],
  malus: [
    [100, 'sawtooth', 0.4, 0.15],
    [80, 'sawtooth', 0.4, 0.15, 0.15],
  ],
  scanner: [
    [1200, 'sine', 0.05, 0.03],
    [1200, 'sine', 0.05, 0.03, 0.15],
  ],
  start: [
    [440, 'square', 0.1, 0.05],
    [554.37, 'square', 0.1, 0.05, 0.1],
    [659.25, 'square', 0.2, 0.05, 0.2],
  ],
};

export function playSound(name) {
  const notes = SOUNDS[name] ?? SOUNDS.click_on;
  try {
    notes.forEach((note) => tone(...note));
  } catch (error) {
    // Un navigateur qui refuse l'audio ne doit jamais casser le jeu.
    console.debug('audio indisponible', error);
  }
}
