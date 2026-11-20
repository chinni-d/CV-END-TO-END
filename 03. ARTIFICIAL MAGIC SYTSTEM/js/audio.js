/**
 * MYSTIC MOTION - Procedural Web Audio Synthesizer
 * Generates cinematic magical audio using the Web Audio API without external mp3 files.
 */

class MysticAudio {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.droneGain = null;
    this.droneOsc = null;
    this.activeHero = "1";
    this.isCasting = false;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();

    // Master volume limiter
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  toggle() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.stopDrone();
    }
    return this.enabled;
  }

  playSpellActivation(heroKey) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (heroKey === "1") {
      // Doctor Strange - Mystic gong / harmonic chord
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.4);
    } else if (heroKey === "2") {
      // Scarlet Witch - Deep ominous chaos surge
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.5);
    } else if (heroKey === "3") {
      // Agatha - Dark witchcraft chime
      osc.type = "triangle";
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.linearRampToValueAtTime(260, now + 0.4);
    } else if (heroKey === "4") {
      // Loki - Shimmering illusion wave
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.linearRampToValueAtTime(660, now + 0.35);
    } else if (heroKey === "5") {
      // Thor - Electric thunder zap
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.3);
    }

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  playThunderBurst() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1200, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
  }

  updateMagicHum(handsCount, heroKey, isTwoHand) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (handsCount === 0) {
      if (this.droneGain) {
        this.droneGain.gain.setTargetAtTime(0, now, 0.2);
      }
      return;
    }

    if (!this.droneOsc) {
      this.droneOsc = this.ctx.createOscillator();
      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(0, now);

      this.droneOsc.type = "sine";
      this.droneOsc.frequency.setValueAtTime(130, now);

      this.droneOsc.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);
      this.droneOsc.start();
    }

    const baseFreqs = { "1": 146.8, "2": 98.0, "3": 110.0, "4": 174.6, "5": 120.0 };
    const targetFreq = (baseFreqs[heroKey] || 130) * (isTwoHand ? 1.5 : 1.0);
    const targetVol = isTwoHand ? 0.22 : 0.12;

    this.droneOsc.frequency.setTargetAtTime(targetFreq, now, 0.15);
    this.droneGain.gain.setTargetAtTime(targetVol, now, 0.1);

    if (heroKey === "5" && Math.random() < 0.05) {
      this.playThunderBurst();
    }
  }

  stopDrone() {
    if (this.droneGain && this.ctx) {
      this.droneGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }
}
