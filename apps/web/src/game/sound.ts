// Simple retro sound effects, generated on the fly (no sound files, so
// nothing to license). Browsers only allow sound after the player taps or
// clicks something, so call unlock() from a button handler.

import { BrickType, type GameState, GameEventType } from "@h2h/game";
import { loadMuted, saveMuted } from "../storage";

type Wave = OscillatorType;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = loadMuted();

  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.18;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    saveMuted(muted);
  }

  private tone(freq: number, ms: number, wave: Wave = "square", endFreq = freq, volume = 1): void {
    if (this.muted || !this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + ms / 1000);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + ms / 1000);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + ms / 1000 + 0.02);
  }

  private noise(ms: number, volume = 1): void {
    if (this.muted || !this.ctx || !this.master) return;
    const length = Math.floor((this.ctx.sampleRate * ms) / 1000);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 1;
    for (let i = 0; i < length; i++) {
      seed = (seed * 16807) % 2147483647;
      data[i] = ((seed / 2147483647) * 2 - 1) * (1 - i / length);
    }
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.buffer = buffer;
    src.connect(gain).connect(this.master);
    src.start();
  }

  /** Plays sounds for whatever happened in the last game frame. */
  play(state: GameState, bricksBefore: readonly number[]): void {
    for (const event of state.events) {
      switch (event.type) {
        case GameEventType.PaddleHit:
          this.tone(330, 60, "square", 300);
          break;
        case GameEventType.WallHit:
          this.tone(200, 30, "square", 180, 0.5);
          break;
        case GameEventType.BrickHit:
          this.tone(260, 50, "triangle", 220);
          break;
        case GameEventType.BrickBroken: {
          const type = bricksBefore[event.index];
          const step = Math.min(12, state.streak);
          const freq = 440 * 2 ** (step / 12);
          this.tone(type === BrickType.Gold ? freq * 2 : freq, 70, "square", freq * 1.5, 0.8);
          break;
        }
        case GameEventType.Explosion:
          this.noise(260, 1.2);
          break;
        case GameEventType.BallLost:
          this.tone(300, 400, "sawtooth", 60, 0.8);
          break;
        case GameEventType.WaveCleared:
          [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 110, "square", f, 0.8), i * 90));
          break;
        case GameEventType.Serve:
          this.tone(520, 50, "square", 700, 0.6);
          break;
      }
    }
  }

  /** Short beep for the countdown. */
  beep(high: boolean): void {
    this.tone(high ? 880 : 440, 120, "square", high ? 880 : 440, 0.7);
  }
}

export const sound = new SoundEngine();
