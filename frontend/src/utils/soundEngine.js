export const SoundFX = {
  ctx: null,
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },
  playTone(freq, type, duration, vol = 0.1) {
    if (typeof window === "undefined") return;
    if (!this.ctx) this.init();
    if (this.ctx.state === "suspended") this.ctx.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },
  clickOn() { this.playTone(600, 'sine', 0.05, 0.05); },
  clickOff() { this.playTone(400, 'sine', 0.05, 0.05); },
  success() {
    this.playTone(440, 'sine', 0.1, 0.08);
    setTimeout(() => this.playTone(554.37, 'sine', 0.2, 0.08), 80);
  },
  error() { this.playTone(150, 'sawtooth', 0.3, 0.1); },
  hint() { this.playTone(880, 'sine', 0.15, 0.05); },
  itemReceived() {
    this.playTone(523.25, 'sine', 0.1, 0.06); 
    setTimeout(() => this.playTone(659.25, 'sine', 0.2, 0.06), 100); 
  },
  itemUsed() {
    this.playTone(300, 'triangle', 0.2, 0.08);
    setTimeout(() => this.playTone(200, 'triangle', 0.2, 0.08), 100);
  },
  malus() {
    this.playTone(100, 'sawtooth', 0.4, 0.15);
    setTimeout(() => this.playTone(80, 'sawtooth', 0.4, 0.15), 150);
  },
  scanner() {
    this.playTone(1200, 'sine', 0.05, 0.03);
    setTimeout(() => this.playTone(1200, 'sine', 0.05, 0.03), 150);
  },
  start() {
    this.playTone(440, 'square', 0.1, 0.05);
    setTimeout(() => this.playTone(554.37, 'square', 0.1, 0.05), 100);
    setTimeout(() => this.playTone(659.25, 'square', 0.2, 0.05), 200);
  }
};

export const playSound = (type) => {
  try {
    switch (type) {
      case 'click_on': SoundFX.clickOn(); break;
      case 'click_off': SoundFX.clickOff(); break;
      case 'success': SoundFX.success(); break;
      case 'game_over': SoundFX.error(); break;
      case 'hint': SoundFX.hint(); break;
      case 'item_receive': SoundFX.itemReceived(); break;
      case 'item_use': SoundFX.itemUsed(); break;
      case 'malus': SoundFX.malus(); break;
      case 'scanner': SoundFX.scanner(); break;
      case 'start': SoundFX.start(); break;
      default: SoundFX.clickOn();
    }
  } catch (e) {
    console.error("Audio block:", e);
  }
};
