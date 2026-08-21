/** Environnement de test : matchers DOM + stubs navigateur. */

import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Web Audio : absent de jsdom, et le jeu ne doit jamais casser sans lui.
class FakeAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
  }
  createOscillator() {
    return {
      type: '',
      frequency: { setValueAtTime() {} },
      connect() {},
      start() {},
      stop() {},
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
    };
  }
  resume() {}
}

window.AudioContext = FakeAudioContext;
window.webkitAudioContext = FakeAudioContext;

if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
}

Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {};

// Aucun test ne doit sortir sur le reseau.
global.fetch = vi.fn(() =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }),
);
