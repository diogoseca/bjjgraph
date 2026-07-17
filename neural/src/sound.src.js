// NGSound — the Neural app's WebAudio synth, a pure subscriber of the fx() beat bus.
// No binary assets: every voice is synthesized (oscillator + gain envelope). Under the
// app's test mode NO AudioContext is ever created; voices log to a ring buffer that the
// journey suite reads exactly like the beats array. Composed into the bundle by build.mjs.
//
// All randomness must come through app.rng("sfx") — this file contains ZERO Math.random
// (enforced by scripts/check_no_raw_random.sh).

// Patch table: id + note list. A note = [f0, f1, dur, delay, type, peak] — frequency glide
// f0→f1 over dur seconds, starting at +delay, oscillator type, peak gain (pre-master).
const NG_PATCHES = {
  land: { id: "thud-soft", notes: [[95, 60, 0.16, 0, "sine", 0.5]] },
  options_dealt: { id: "deal-arp", notes: [[320, 320, 0.05, 0, "square", 0.12], [400, 400, 0.05, 0.06, "square", 0.12], [500, 500, 0.06, 0.12, "square", 0.14]] },
  commit: { id: "commit-press", notes: [[220, 180, 0.1, 0, "triangle", 0.3]] },
  sweep_start: { id: "riser-short", notes: [[180, 420, 0.5, 0, "sawtooth", 0.1]] },
  detonation: { id: "boom", notes: [[140, 50, 0.35, 0, "sine", 0.7], [700, 400, 0.12, 0, "triangle", 0.2]] },
  hit_stop: { id: "thud-stop", notes: [[110, 70, 0.12, 0, "sine", 0.55]] },
  impact_success: { id: "chime-fifth", notes: [[660, 660, 0.22, 0, "sine", 0.35], [990, 990, 0.26, 0.03, "sine", 0.25]] },
  impact_fail: { id: "thud-dull", notes: [[130, 85, 0.2, 0, "sine", 0.45], [98, 80, 0.16, 0.02, "triangle", 0.2]] },
  bonus_pumped: { id: "ding-up", notes: [[520, 660, 0.14, 0, "sine", 0.3], [660, 880, 0.12, 0.1, "sine", 0.22]] },
  mc_correct: { id: "ding-up", notes: [[520, 660, 0.14, 0, "sine", 0.3], [660, 880, 0.12, 0.1, "sine", 0.22]] },
  mc_wrong: { id: "buzz-muted", notes: [[130, 110, 0.16, 0, "square", 0.16]] },
  timer_refund: { id: "plus-tick", notes: [[740, 900, 0.07, 0, "sine", 0.18]] },
  expiry_warning: { id: "clock-tick", notes: [[980, 980, 0.045, 0, "square", 0.16]] },
  auto_pick: { id: "pop", notes: [[300, 500, 0.08, 0, "triangle", 0.25]] },
  caught: { major: 1, id: "sting-tense", notes: [[440, 440, 0.4, 0, "sawtooth", 0.14], [466, 466, 0.4, 0, "sawtooth", 0.14]] },
  opponent_attack: { id: "sting-low", notes: [[190, 150, 0.22, 0, "sawtooth", 0.2]] },
  escape: { id: "relief-exhale", notes: [[600, 300, 0.35, 0, "sine", 0.25]] },
  relief: { id: "relief-major", notes: [[523, 523, 0.18, 0, "sine", 0.22], [659, 659, 0.2, 0.06, "sine", 0.2]] },
  lesson_done: { major: 1, id: "jingle-3", notes: [[523, 523, 0.12, 0, "sine", 0.3], [659, 659, 0.12, 0.11, "sine", 0.3], [784, 784, 0.2, 0.22, "sine", 0.32]] },
  unit_done: { major: 1, id: "jingle-big", notes: [[523, 523, 0.12, 0, "sine", 0.32], [659, 659, 0.12, 0.1, "sine", 0.32], [784, 784, 0.14, 0.2, "sine", 0.34], [1047, 1047, 0.3, 0.32, "sine", 0.36]] },
  checkpoint_passed: { major: 1, id: "jingle-big", notes: [[523, 523, 0.12, 0, "sine", 0.32], [659, 659, 0.12, 0.1, "sine", 0.32], [784, 784, 0.14, 0.2, "sine", 0.34], [1047, 1047, 0.3, 0.32, "sine", 0.36]] },
  checkpoint_failed: { id: "drain-short", notes: [[330, 220, 0.3, 0, "triangle", 0.24]] },
  belt_unlocked: { major: 1, id: "riser-unlock", notes: [[200, 800, 0.7, 0, "sawtooth", 0.16], [400, 1600, 0.5, 0.25, "sine", 0.14]] },
  victory_cascade: { major: 1, id: "fanfare-arp", notes: [[523, 523, 0.14, 0, "square", 0.2], [659, 659, 0.14, 0.11, "square", 0.2], [784, 784, 0.14, 0.22, "square", 0.22], [1047, 1047, 0.4, 0.33, "square", 0.26]] },
  finish: { major: 1, id: "finish-hit", notes: [[880, 880, 0.18, 0, "sine", 0.3], [1174, 1174, 0.28, 0.06, "sine", 0.26]] },
  defeat_drain: { major: 1, id: "drain-long", notes: [[392, 196, 0.7, 0, "triangle", 0.26]] },
  belt_test_start: { major: 1, id: "gong-start", notes: [[196, 190, 0.8, 0, "sine", 0.4], [392, 380, 0.6, 0.05, "sine", 0.2]] },
  belt_test_won: { major: 1, id: "fanfare-belt", notes: [[523, 523, 0.16, 0, "square", 0.22], [659, 659, 0.16, 0.14, "square", 0.22], [784, 784, 0.16, 0.28, "square", 0.24], [1047, 1047, 0.35, 0.42, "square", 0.28], [784, 784, 0.16, 0.85, "square", 0.2], [1047, 1047, 0.3, 1.0, "square", 0.24], [1319, 1319, 0.6, 1.15, "square", 0.28], [1568, 1568, 0.9, 1.5, "sine", 0.24]] },
  belt_test_lost: { major: 1, id: "drain-long", notes: [[392, 196, 0.7, 0, "triangle", 0.26]] },
  roll_end: { id: "close-soft", notes: [[330, 262, 0.3, 0, "sine", 0.16]] },
  path_opened: { id: "page-open", notes: [[440, 554, 0.12, 0, "sine", 0.14]] },
  jit_opened: { id: "page-open", notes: [[440, 554, 0.12, 0, "sine", 0.14]] },
  escape_odds_pumped: { id: "ding-up", notes: [[520, 660, 0.14, 0, "sine", 0.3]] },
  beacon_moved: { id: "beacon-blip", notes: [[880, 880, 0.04, 0, "sine", 0.08]] },
};

class NGSound {
  constructor(app) {
    this.app = app;
    this.soundLog = [];
    this._ctxCreated = false;
    this._ctx = null;
    this._lastVoice = -1e9;
    this._lastByBeat = {};
    this._active = 0;
    if (!app.isTest()) {
      // AudioContext must wait for a user gesture (autoplay policy); pre-unlock beats drop
      const unlock = () => this._ensureCtx();
      window.addEventListener("pointerdown", unlock, { once: true, passive: true });
      window.addEventListener("keydown", unlock, { once: true });
    }
  }
  enabled() { return this.app.get("sound", "on") !== "off"; }
  volume() { const v = parseFloat(this.app.get("soundVolume", "0.5")); return Math.max(0, Math.min(1, isNaN(v) ? 0.5 : v)); }
  _ensureCtx() {
    if (this.app.isTest() || this._ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { this._ctx = new AC(); this._ctxCreated = true; }
    } catch (e) { /* no audio — stay silent */ }
  }
  beat(name, props) {
    if (!this.enabled()) return;
    const patch = NG_PATCHES[name];
    if (!patch) return;
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    if (now - (this._lastByBeat[name] || -1e9) < 100) return; // same-beat dedupe
    if (now - this._lastVoice < 40 && !patch.major) return;  // voice spacing (majors are rare and always land)
    this._lastByBeat[name] = now;
    this._lastVoice = now;
    if (this.app.isTest()) {
      this.soundLog.push({ t: this.app.now || 0, beat: name, patch: patch.id, volume: this.volume() });
      if (this.soundLog.length > 4000) this.soundLog.splice(0, 1000);
      return;
    }
    this._play(patch);
  }
  _play(patch) {
    const ctx = this._ctx;
    if (!ctx || ctx.state === "suspended" || this._active >= 4) return; // ≤4 voices
    const master = this.volume() * 0.6;
    if (master <= 0) return;
    this._active++;
    const t0 = ctx.currentTime;
    let longest = 0;
    for (const [f0, f1, dur, delay, type, peak] of patch.notes) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      // barely-audible humanization, seeded through the app's rng seam (never Math.random)
      const detune = (this.app.rng("sfx") - 0.5) * 6;
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, f0 + detune), t0 + delay);
      if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + delay + dur);
      g.gain.setValueAtTime(0.0001, t0 + delay);
      g.gain.linearRampToValueAtTime(peak * master, t0 + delay + 0.02); // 20ms ramp, no clicks
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(t0 + delay);
      osc.stop(t0 + delay + dur + 0.05);
      longest = Math.max(longest, delay + dur);
    }
    setTimeout(() => { this._active = Math.max(0, this._active - 1); }, (longest + 0.1) * 1000);
  }
}
