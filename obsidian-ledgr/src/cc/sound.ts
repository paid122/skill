/** All sound is synthesised with the Web Audio API (no files), as in the prototype. */

export class Sound {
  AC: AudioContext | null = null;
  on = false; // sound is playing (unlocked by a user gesture and allowed)
  pref = true; // the user wants sound

  audio(): AudioContext | null {
    if (this.AC) return this.AC;
    try { this.AC = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { this.AC = null; }
    return this.AC;
  }

  /** Called on a user gesture: browsers only allow audio after one. */
  unlock() { if (this.pref && !this.on) { this.audio(); if (this.AC) { void this.AC.resume(); this.on = true; } } }

  tone(f: number, d: number, type: OscillatorType = "sine", vol = 0.15, glideTo?: number, delay = 0) {
    const AC = this.AC;
    if (!this.on || !AC) return;
    const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d + 0.05);
  }

  noise(d: number, vol = 0.2, from = 800, to = 8000, delay = 0) {
    const AC = this.AC;
    if (!this.on || !AC) return;
    const t = AC.currentTime + delay, n = AC.sampleRate * d, b = AC.createBuffer(1, n, AC.sampleRate), c = b.getChannelData(0);
    for (let i = 0; i < n; i++) c[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = b;
    const f = AC.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.2; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + d);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + d * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f).connect(g).connect(AC.destination); src.start(t);
  }

  blip() { this.tone(1400, 0.05, "square", 0.025); }
  alarm(n = 3) { for (let i = 0; i < n; i++) { this.tone(880, 0.14, "square", 0.07, undefined, i * 0.22); this.tone(660, 0.14, "square", 0.05, undefined, i * 0.22 + 0.1); } }

  /** The intro's sound effects. */
  fx = {
    drone: () => { this.tone(55, 3.6, "sawtooth", 0.05, 40); this.tone(82.5, 3.6, "sine", 0.08, 60); },
    beat: () => { this.tone(60, 0.35, "sine", 0.35, 38); this.tone(52, 0.35, "sine", 0.25, 34, 0.18); },
    tick: () => { this.tone(1800 + Math.random() * 600, 0.04, "square", 0.03); },
    riser: () => { this.noise(2.2, 0.22, 300, 9000); this.tone(110, 2.2, "sawtooth", 0.05, 880); },
    boom: () => { this.tone(70, 1.8, "sine", 0.6, 28); this.noise(1.2, 0.35, 4000, 120); this.tone(140, 0.5, "square", 0.08, 40); },
    lock: () => { this.tone(880, 0.08, "square", 0.06); this.tone(1320, 0.12, "square", 0.05, undefined, 0.07); },
    glitch: () => { this.noise(0.18, 0.18, 2000, 2600); this.tone(200 + Math.random() * 900, 0.12, "square", 0.05); },
    whoosh: () => { this.noise(0.7, 0.25, 6000, 300); },
    chord: () => { [220, 277, 330, 440].forEach((f, i) => this.tone(f, 2.4, "triangle", 0.05, undefined, i * 0.04)); },
  };

  close() { void this.AC?.close().catch(() => undefined); this.AC = null; this.on = false; }
}
