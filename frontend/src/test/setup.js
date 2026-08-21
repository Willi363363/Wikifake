/**
 * Environnement des tests unitaires.
 *
 * jsdom ne fournit ni Web Audio ni scrollIntoView, et aucun test ne doit
 * sortir sur le réseau : les trois sont bouchonnés ici plutôt que dans chaque
 * fichier.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';

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
      connect() {}, start() {}, stop() {},
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
    };
  }
  resume() {}
  close() {}
}

window.AudioContext = FakeAudioContext;
window.webkitAudioContext = FakeAudioContext;
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {};

beforeEach(() => {
  localStorage.clear();
  // Un test qui appelle le réseau sans le vouloir doit échouer bruyamment.
  global.fetch = vi.fn(() => Promise.reject(new Error('appel réseau non bouchonné')));
});

afterEach(() => {
  vi.restoreAllMocks();
});
