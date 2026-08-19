/**
 * Web Audio sound effects.
 *
 * Every cue is synthesised from oscillators, so the game ships no audio assets.
 * The AudioContext is created lazily on the first cue because browsers refuse
 * to start one before a user gesture.
 */

let ctx = null;

function audioContext() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Play a single decaying tone. */
function tone(freq, type, duration, volume = 0.1) {
  const audio = audioContext();
  if (!audio) return;

  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime);
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration);
}

/** Play a sequence of `[freq, type, duration, volume, delayMs]` steps. */
function sequence(steps) {
  steps.forEach(([freq, type, duration, volume, delay]) => {
    if (delay) setTimeout(() => tone(freq, type, duration, volume), delay);
    else tone(freq, type, duration, volume);
  });
}

/** Every cue the game can play, keyed by the name passed to `playSound`. */
const CUES = {
  click_on:     () => tone(600, 'sine', 0.05, 0.05),
  click_off:    () => tone(400, 'sine', 0.05, 0.05),
  success:      () => sequence([[440, 'sine', 0.1, 0.08], [554.37, 'sine', 0.2, 0.08, 80]]),
  game_over:    () => tone(150, 'sawtooth', 0.3, 0.1),
  hint:         () => tone(880, 'sine', 0.15, 0.05),
  item_receive: () => sequence([[523.25, 'sine', 0.1, 0.06], [659.25, 'sine', 0.2, 0.06, 100]]),
  item_use:     () => sequence([[300, 'triangle', 0.2, 0.08], [200, 'triangle', 0.2, 0.08, 100]]),
  malus:        () => sequence([[100, 'sawtooth', 0.4, 0.15], [80, 'sawtooth', 0.4, 0.15, 150]]),
  scanner:      () => sequence([[1200, 'sine', 0.05, 0.03], [1200, 'sine', 0.05, 0.03, 150]]),
  start:        () => sequence([
    [440, 'square', 0.1, 0.05],
    [554.37, 'square', 0.1, 0.05, 100],
    [659.25, 'square', 0.2, 0.05, 200],
  ]),
};

/**
 * Play a named cue. Audio is decorative, so a blocked or missing AudioContext
 * must never interrupt gameplay.
 */
export function playSound(name) {
  try {
    (CUES[name] || CUES.click_on)();
  } catch (err) {
    console.error('Audio blocked:', err);
  }
}
