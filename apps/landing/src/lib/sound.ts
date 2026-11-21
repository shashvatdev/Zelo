"use client";

/**
 * Sound effects and music are synthesised with the Web Audio API. The voiceover is a set of
 * small pre-rendered clips in /public/audio.
 *
 * Browsers only allow audio after a user gesture, so the page arms sound and `enable()` runs
 * on the visitor's first click, tap or key press.
 */

export type SoundCue =
  | { t: number; kind: "tick"; pitch?: number; vol?: number }
  | { t: number; kind: "tock"; pitch?: number; vol?: number }
  | { t: number; kind: "whoosh" }
  | { t: number; kind: "chime" }
  | { t: number; kind: "voice"; clip: number }
  | { t: number; kind: "music"; duration: number };

const VOICE_CLIPS = [1, 2, 3, 4, 5].map((n) => `/audio/vo${n}.mp3`);

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private session: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private voiceData: Promise<ArrayBuffer[]> | null = null;
  private voices: AudioBuffer[] = [];
  enabled = false;

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /** Starts downloading the voice clips early, so they are ready when sound turns on. */
  preload() {
    if (!this.voiceData) {
      this.voiceData = Promise.all(
        VOICE_CLIPS.map((url) => fetch(url).then((r) => r.arrayBuffer())),
      ).catch(() => []);
    }
  }

  /** True when the browser already allows audio (e.g. the visitor has interacted before). */
  canAutoplay(): boolean {
    try {
      return this.ensure().state === "running";
    } catch {
      return false;
    }
  }

  /** Turns sound on. There is no background drone: only the intro's music and short effects. */
  async enable(opts: { voices?: boolean } = {}) {
    const ctx = this.ensure();
    const resumed = ctx.resume();
    this.enabled = true;
    await resumed;
    if (opts.voices !== false) await this.decodeVoices();
  }

  disable() {
    this.enabled = false;
    this.stopSession();
  }

  private async decodeVoices() {
    if (this.voices.length || !this.ctx) return;
    this.preload();
    const data = await this.voiceData!;
    try {
      this.voices = await Promise.all(
        data.map((buf) => this.ctx!.decodeAudioData(buf.slice(0))),
      );
    } catch {
      this.voices = [];
    }
  }

  /** Fades out whatever the last `play(..., { session: true })` scheduled. */
  stopSession() {
    if (!this.session || !this.ctx) return;
    const g = this.session;
    const now = this.ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(0, now + 0.25);
    setTimeout(() => g.disconnect(), 400);
    this.session = null;
  }

  /**
   * Schedules cues relative to now. With `session`, the cues go through their own bus that
   * replaces (and fades out) the previous session, so a restart never overlaps the old one.
   */
  play(cues: SoundCue[], opts: { session?: boolean } = {}) {
    if (!this.enabled || !this.ctx || !this.master) return;
    let out: AudioNode = this.master;
    if (opts.session) {
      this.stopSession();
      this.session = this.ctx.createGain();
      this.session.connect(this.master);
      out = this.session;
    }
    const base = this.ctx.currentTime + 0.04;
    for (const cue of cues) {
      const at = base + cue.t;
      switch (cue.kind) {
        case "tock":
          this.tock(out, at, cue.pitch ?? 1, cue.vol ?? 0.5);
          break;
        case "tick":
          this.tick(out, at, cue.pitch ?? 1, cue.vol ?? 0.18);
          break;
        case "whoosh":
          this.whoosh(out, at);
          break;
        case "chime":
          this.chime(out, at);
          break;
        case "voice":
          this.voice(out, at, cue.clip);
          break;
        case "music":
          this.music(out, at, cue.duration);
          break;
      }
    }
  }

  private noiseBuffer(ctx: AudioContext) {
    if (!this.noise) {
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    return this.noise;
  }

  /** A short wooden "khat": a falling triangle blip plus a click of filtered noise. */
  private tock(out: AudioNode, at: number, pitch: number, vol: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(820 * pitch, at);
    osc.frequency.exponentialRampToValueAtTime(240 * pitch, at + 0.07);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.11);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + 0.13);

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400 * pitch;
    bp.Q.value = 1.2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vol * 0.5, at);
    ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.025);
    src.connect(bp).connect(ng).connect(out);
    src.start(at, Math.random() * 0.5, 0.04);
  }

  /** A very light tick: list rows sliding in, the AI typing. */
  private tick(out: AudioNode, at: number, pitch: number, vol: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1800 * pitch, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + 0.05);
  }

  /** The flat list breaking apart. */
  private whoosh(out: AudioNode, at: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(300, at);
    bp.frequency.exponentialRampToValueAtTime(2600, at + 0.32);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.32, at + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);
    src.connect(bp).connect(g).connect(out);
    src.start(at, 0, 0.5);
  }

  /** Two soft bell notes when the map is complete. */
  private chime(out: AudioNode, at: number) {
    const ctx = this.ctx!;
    [659.25, 987.77].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      const s = at + i * 0.09;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.16, s + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 1.4);
      osc.connect(g).connect(out);
      osc.start(s);
      osc.stop(s + 1.5);
    });
  }

  private voice(out: AudioNode, at: number, clip: number) {
    const buf = this.voices[clip];
    if (!buf) return;
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 1.1;
    src.connect(g).connect(out);
    src.start(at);
  }

  /**
   * A short music bed: Am, F, C, G at 96 bpm with a plucked arpeggio, a soft bass and a light
   * kick. It sits under the voiceover, so everything is kept quiet.
   */
  private music(out: AudioNode, at: number, duration: number) {
    const ctx = this.ctx!;
    const beat = 60 / 96;
    const chords: { bass: number; arp: number[] }[] = [
      { bass: 110, arp: [220, 329.63, 440, 523.25] },
      { bass: 87.31, arp: [174.61, 261.63, 349.23, 440] },
      { bass: 130.81, arp: [261.63, 392, 523.25, 659.25] },
      { bass: 98, arp: [196, 293.66, 392, 493.88] },
    ];
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, at);
    bus.gain.exponentialRampToValueAtTime(1, at + 0.6);
    bus.gain.setValueAtTime(1, at + duration - 1.2);
    bus.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2200;
    bus.connect(lp).connect(out);

    const pluck = (f: number, s: number, v: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(v, s + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.45);
      o.connect(g).connect(bus);
      o.start(s);
      o.stop(s + 0.5);
    };
    const bass = (f: number, s: number, len: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.11, s + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, s + len);
      o.connect(g).connect(bus);
      o.start(s);
      o.stop(s + len + 0.05);
    };
    const kick = (s: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(120, s);
      o.frequency.exponentialRampToValueAtTime(45, s + 0.18);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(0.16, s + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.28);
      o.connect(g).connect(bus);
      o.start(s);
      o.stop(s + 0.3);
    };

    const totalBeats = Math.ceil(duration / beat);
    for (let b = 0; b < totalBeats; b++) {
      const s = at + b * beat;
      const chord = chords[Math.floor(b / 4) % chords.length];
      if (b % 4 === 0) bass(chord.bass, s, beat * 3.8);
      if (b % 2 === 0 && b > 3) kick(s);
      // Two arpeggio notes per beat.
      pluck(chord.arp[(b * 2) % 4], s, 0.045);
      pluck(chord.arp[(b * 2 + 1) % 4], s + beat / 2, 0.035);
    }
  }
}

export const sound =
  typeof window === "undefined"
    ? (null as unknown as SoundEngine)
    : new SoundEngine();
