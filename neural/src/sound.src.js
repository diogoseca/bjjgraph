// NGSound - the Neural app's synthesized electrical/space audio system.
// It subscribes to fx() beats, creates no AudioContext in test mode, and uses
// app.rng("sfx") for every noise sample and pitch variation.

const NG_SOUND_CATALOG = [
  { beat: "land", label: "Gravity settle", group: "Flow", voice: "gravity-settle", durationMs: 360, context: "The player arrives at a position.", character: "A soft orbital drop with a low atmospheric tail." },
  { beat: "options_dealt", label: "Neural scan", group: "Flow", voice: "neural-scan", durationMs: 420, context: "A new hand of techniques appears.", character: "Three quick impulses sweep across the stereo field." },
  { beat: "roll_staged", label: "Orbit staged", group: "Flow", voice: "orbit-stage", durationMs: 360, context: "A graph node is staged as the next starting position.", character: "A distant locator pulse settles onto the selected node." },
  { beat: "commit", label: "Capacitor latch", group: "Decision", voice: "capacitor-latch", durationMs: 260, context: "The player commits to a technique.", character: "A compact electrical lock with restrained weight." },
  { beat: "sweep_start", label: "Warp charge", group: "Decision", voice: "warp-charge", durationMs: 760, context: "The probability sweep begins.", character: "Filtered current accelerates through a wide spatial rise." },
  { beat: "detonation", label: "Plasma impact", group: "Decision", voice: "plasma-impact", durationMs: 640, context: "The roll lands inside the success band.", character: "A compressed low impact wrapped in ionized air." },
  { beat: "hit_stop", label: "Signal cut", group: "Decision", voice: "signal-cut", durationMs: 300, context: "The roll misses and motion briefly freezes.", character: "A damped disconnect collapses without an arcade buzz." },
  { beat: "impact_success", label: "Synapse connected", group: "Decision", voice: "synapse-connect", durationMs: 620, context: "A move or outcome resolves successfully.", character: "A crystalline connection opens upward across the field." },
  { beat: "impact_fail", label: "Synapse dropped", group: "Decision", voice: "synapse-drop", durationMs: 480, context: "A move fails or is countered.", character: "A muted neural fold sinks into a low filtered tail." },
  { beat: "timer_refund", label: "Decision extended", group: "Decision", voice: "ion-credit", durationMs: 240, context: "A correct landing answer refunds decision time.", character: "A short ion tick opens rather than rings." },
  { beat: "expiry_warning", label: "Window closing", group: "Decision", voice: "pulse-clock", durationMs: 160, context: "The decision timer enters its final seconds.", character: "A dry radar pulse signals urgency without alarm." },
  { beat: "auto_pick", label: "Autopilot lock", group: "Decision", voice: "auto-lock", durationMs: 260, context: "The decision window expires and a move is selected.", character: "A compact targeting chirp closes the hand." },
  { beat: "stakes", label: "Opponent acquired", group: "Defense", voice: "threat-scan", durationMs: 720, context: "A ranked opponent and match stakes are introduced.", character: "A distant dual-tone scan establishes tension." },
  { beat: "opponent_attack", label: "Threat inbound", group: "Defense", voice: "threat-inbound", durationMs: 520, context: "The opponent commits to an attack.", character: "A low directional warning crosses toward the player." },
  { beat: "defend_start", label: "Shield charging", group: "Defense", voice: "shield-charge", durationMs: 680, priority: 3, sceneMs: 760, context: "A submission defense sequence opens.", character: "A rising protective field gathers around a deep pulse." },
  { beat: "caught", label: "Containment field", group: "Defense", voice: "containment-field", durationMs: 920, priority: 2, context: "The player is caught in a submission threat.", character: "Close dissonant currents narrow the available space." },
  { beat: "escape", label: "Phase escape", group: "Defense", voice: "phase-escape", durationMs: 660, context: "The player exits the immediate submission.", character: "A rising current slips sideways out of containment." },
  { beat: "relief", label: "Pressure released", group: "Defense", voice: "pressure-release", durationMs: 640, context: "The full defensive exchange resolves safely.", character: "A warm suspended chord exhales into silence." },
  { beat: "escape_odds_pumped", label: "Escape route charged", group: "Defense", voice: "ion-credit", durationMs: 240, context: "Study improves the odds of an escape.", character: "A restrained electrical credit confirms the advantage." },
  { beat: "bonus_pumped", label: "Knowledge connected", group: "Learning", voice: "synapse-connect", durationMs: 620, context: "A study answer improves technique probability.", character: "A quick crystalline bridge confirms useful recall." },
  { beat: "mc_correct", label: "Answer confirmed", group: "Learning", voice: "synapse-connect", durationMs: 620, context: "A multiple-choice answer is correct.", character: "A bright neural connection resolves upward." },
  { beat: "mc_wrong", label: "Retry signal", group: "Learning", voice: "retry-fold", durationMs: 440, context: "A multiple-choice answer is wrong.", character: "A soft descending fold keeps the player moving." },
  { beat: "recall_proven", label: "Recall proven", group: "Learning", voice: "constellation-lock", durationMs: 1120, context: "A card reaches recall-proven mastery.", character: "A small constellation assembles into a stable chord." },
  { beat: "combo", label: "Momentum rising", group: "Momentum", voice: "momentum-rise", durationMs: 440, context: "A correct landing answer grows the combo.", character: "Two electric impulses climb with controlled energy." },
  { beat: "combo_big", label: "Momentum supernova", group: "Momentum", voice: "momentum-supernova", durationMs: 1040, context: "Momentum reaches Ultra or a higher tier.", character: "A broad stellar flare rewards the rare peak." },
  { beat: "combo_break", label: "Filament snapped", group: "Momentum", voice: "filament-snap", durationMs: 520, context: "A wrong or ignored answer breaks momentum.", character: "A stretched current severs and falls away." },
  { beat: "lesson_done", label: "Lesson orbit complete", group: "Progression", voice: "orbit-complete", durationMs: 920, context: "A curriculum lesson is completed.", character: "Three soft bodies settle into a resolved orbit." },
  { beat: "unit_done", label: "Unit constellation complete", group: "Progression", voice: "constellation-complete", durationMs: 1380, context: "Every lesson in a unit is complete.", character: "A wider constellation blooms without a game-show jingle." },
  { beat: "checkpoint_start", label: "Checkpoint gate open", group: "Progression", voice: "gate-open", durationMs: 860, context: "A checkpoint assessment begins.", character: "A low aperture opens beneath a focused upper tone." },
  { beat: "checkpoint_passed", label: "Checkpoint resolved", group: "Progression", voice: "constellation-complete", durationMs: 1380, context: "A checkpoint is passed.", character: "The completed path resolves as a calm stellar chord." },
  { beat: "checkpoint_failed", label: "Checkpoint unstable", group: "Progression", voice: "reactor-dim", durationMs: 760, context: "A checkpoint must be attempted again.", character: "The field dims but leaves a recoverable pulse." },
  { beat: "belt_test_start", label: "Belt test threshold", group: "Progression", voice: "deep-gong", durationMs: 1360, context: "A belt test starts.", character: "A deep synthetic resonance marks the threshold." },
  { beat: "belt_test_won", label: "Belt stellar fanfare", group: "Progression", voice: "belt-fanfare", durationMs: 2480, priority: 5, sceneMs: 2600, context: "A belt test is won.", character: "A two-stage starflight fanfare lands with real scale." },
  { beat: "belt_test_lost", label: "Belt reactor shutdown", group: "Progression", voice: "reactor-shutdown", durationMs: 1760, priority: 5, sceneMs: 1900, context: "A belt test ends in defeat.", character: "Energy drains downward, leaving a quiet recovery tone." },
  { beat: "tutorial_done", label: "Tutorial constellation", group: "Progression", voice: "constellation-lock", durationMs: 1120, context: "The full tutorial checklist is completed.", character: "A compact constellation confirms orientation." },
  { beat: "challenge_completed", label: "Objective logged", group: "Rewards", voice: "objective-tick", durationMs: 280, context: "A Challenge objective is satisfied by gameplay evidence.", character: "A brief electrical confirmation that stays out of the way." },
  { beat: "patch_earned", label: "Patch stitched", group: "Rewards", voice: "patch-weave", durationMs: 720, context: "A patch acknowledges a meaningful milestone.", character: "A low handshake resolves into a bright woven pair." },
  { beat: "coin_earned", label: "Mat Coin minted", group: "Rewards", voice: "coin-mint", durationMs: 320, context: "A mint-once Mat Coin lands, with no balance and no gameplay effect.", character: "A small metallic flip that never takes itself seriously." },
  { beat: "victory_cascade", label: "Star-jump victory", group: "Outcomes", voice: "stellar-fanfare", durationMs: 2280, priority: 4, sceneMs: 2380, context: "A roll ends in victory and the graph cascade begins.", character: "A deep launch expands through ascending constellations." },
  { beat: "finish", label: "Terminal lock", group: "Outcomes", voice: "terminal-lock", durationMs: 980, priority: 2, context: "The finishing submission is confirmed.", character: "A focused high lock seals over a stable low core." },
  { beat: "defeat_drain", label: "Reactor shutdown", group: "Outcomes", voice: "reactor-shutdown", durationMs: 1760, priority: 4, sceneMs: 1840, context: "The opponent wins the roll.", character: "A controlled power-down collapses into a distant harmonic." },
  { beat: "roll_end", label: "Orbit closed", group: "Outcomes", voice: "orbit-close", durationMs: 640, priority: 1, context: "The roll report finishes its terminal sequence.", character: "A soft descending orbit closes the sound field." },
  { beat: "jit_opened", label: "Drill hologram", group: "Interface", voice: "holo-open", durationMs: 360, context: "A just-in-time drill opens.", character: "A subtle spatial panel cue orients the player." },
  { beat: "beacon_moved", label: "Graph beacon", group: "Interface", voice: "radar-blip", durationMs: 180, context: "The active graph beacon moves to a new node.", character: "A tiny positional ping, intentionally near the noise floor." },
]

// Tone: [f0, f1, duration, delay, wave, gain, pan, filterStart, filterEnd].
// Noise: [duration, delay, gain, panStart, panEnd, filterStart, filterEnd, filterType].
const NG_VOICES = {
  "gravity-settle": { tones: [[112, 54, .3, 0, "triangle", .32, 0, 680, 240]], noise: [[.2, 0, .055, -.15, .15, 3200, 520, "lowpass"]] },
  "neural-scan": { tones: [[360, 520, .11, 0, "sine", .15, -.65, 2600, 5200], [480, 720, .12, .08, "sine", .14, 0, 3200, 6200], [620, 960, .16, .16, "sine", .13, .65, 3800, 7200]], echo: [.105, .18] },
  "orbit-stage": { tones: [[240, 420, .22, 0, "sine", .16, -.35, 900, 3600], [480, 360, .26, .08, "triangle", .1, .35, 2600, 820]], echo: [.14, .16] },
  "capacitor-latch": { tones: [[280, 168, .14, 0, "triangle", .28, 0, 1800, 620], [1180, 620, .09, .02, "sine", .08, .25, 6200, 1800]], noise: [[.09, 0, .035, -.2, .2, 6200, 1200, "bandpass"]] },
  "warp-charge": { tones: [[148, 760, .62, 0, "sine", .19, 0, 420, 3600], [296, 1320, .52, .11, "triangle", .075, -.4, 820, 6200]], noise: [[.62, .02, .075, -.85, .85, 700, 7600, "highpass"]], echo: [.12, .22] },
  "plasma-impact": { tones: [[92, 46, .52, 0, "sine", .38, 0, 680, 180], [660, 240, .24, .01, "triangle", .1, .3, 4200, 620]], noise: [[.34, 0, .11, -.7, .7, 5200, 420, "bandpass"]], echo: [.09, .12] },
  "signal-cut": { tones: [[188, 62, .24, 0, "triangle", .25, 0, 920, 180]], noise: [[.15, 0, .05, .25, -.25, 1800, 260, "lowpass"]] },
  "synapse-connect": { tones: [[520, 760, .2, 0, "sine", .2, -.35, 2400, 6200], [760, 1120, .32, .12, "sine", .16, .35, 3600, 8200]], noise: [[.26, .08, .026, -.5, .5, 4200, 9600, "highpass"]], echo: [.13, .2] },
  "synapse-drop": { tones: [[252, 96, .38, 0, "triangle", .22, .15, 1200, 240], [196, 72, .3, .07, "sine", .1, -.2, 720, 160]], noise: [[.24, 0, .034, .3, -.3, 1200, 180, "lowpass"]] },
  "ion-credit": { tones: [[620, 920, .14, 0, "sine", .13, -.25, 2800, 7200], [920, 740, .12, .08, "sine", .08, .25, 6200, 2600]], echo: [.09, .12] },
  "pulse-clock": { tones: [[920, 760, .075, 0, "triangle", .13, 0, 5200, 2200]], noise: [[.06, 0, .025, 0, 0, 6800, 3200, "bandpass"]] },
  "auto-lock": { tones: [[360, 740, .1, 0, "triangle", .14, -.25, 1800, 6200], [740, 520, .12, .08, "sine", .11, .25, 6200, 2200]] },
  "threat-scan": { major: 1, tones: [[244, 182, .58, 0, "triangle", .16, -.55, 820, 360], [257, 191, .58, .04, "sine", .13, .55, 920, 380]], noise: [[.5, .02, .035, -.7, .7, 2400, 520, "bandpass"]], echo: [.18, .2] },
  "threat-inbound": { tones: [[220, 128, .38, 0, "triangle", .18, .65, 920, 280], [440, 260, .22, .05, "sine", .07, .2, 2200, 620]], noise: [[.28, 0, .036, .8, -.15, 2800, 420, "bandpass"]] },
  "shield-charge": { tones: [[128, 310, .52, 0, "sine", .18, 0, 280, 1600], [420, 720, .34, .16, "triangle", .09, -.35, 1800, 5200]], noise: [[.46, .04, .055, .75, -.75, 620, 6200, "highpass"]], echo: [.12, .18] },
  "containment-field": { major: 1, tones: [[146, 118, .78, 0, "triangle", .18, -.35, 520, 220], [154, 124, .78, .02, "sine", .16, .35, 580, 240]], noise: [[.66, 0, .042, -.2, .2, 1200, 260, "lowpass"]], echo: [.19, .22] },
  "phase-escape": { tones: [[210, 680, .48, 0, "sine", .18, -.75, 820, 4200], [420, 980, .34, .14, "triangle", .09, .25, 1800, 6200]], noise: [[.42, .04, .04, -.85, .85, 1200, 7200, "highpass"]], echo: [.11, .18] },
  "pressure-release": { tones: [[523, 392, .42, 0, "sine", .17, -.25, 2600, 980], [659, 494, .48, .06, "sine", .14, .25, 3200, 1200]], noise: [[.38, .05, .025, .4, -.4, 4200, 800, "lowpass"]], echo: [.16, .2] },
  "retry-fold": { tones: [[260, 142, .32, 0, "triangle", .18, 0, 1100, 320], [196, 124, .26, .06, "sine", .08, -.2, 760, 260]], noise: [[.2, .01, .025, .2, -.2, 1400, 280, "lowpass"]] },
  "constellation-lock": { major: 1, tones: [[392, 392, .22, 0, "sine", .13, -.55, 2200, 3400], [587, 587, .24, .13, "sine", .14, -.15, 3200, 4800], [784, 784, .28, .27, "sine", .14, .25, 4200, 6200], [1175, 1047, .42, .42, "sine", .13, .55, 6800, 5200]], noise: [[.58, .18, .03, -.8, .8, 3600, 9200, "highpass"]], echo: [.17, .24] },
  "momentum-rise": { major: 1, tones: [[620, 860, .16, 0, "triangle", .17, -.4, 2600, 6200], [860, 1180, .22, .11, "sine", .16, .4, 4200, 7800]], echo: [.105, .16] },
  "momentum-supernova": { major: 1, tones: [[392, 784, .26, 0, "triangle", .16, -.65, 1600, 6200], [523, 1047, .34, .13, "sine", .18, -.2, 2200, 8200], [784, 1568, .5, .28, "sine", .18, .55, 3600, 9800]], noise: [[.62, .12, .075, -.9, .9, 2200, 10800, "highpass"]], echo: [.14, .24] },
  "filament-snap": { major: 1, tones: [[620, 158, .3, 0, "sawtooth", .12, .45, 2600, 240], [260, 92, .28, .07, "triangle", .15, -.3, 820, 160]], noise: [[.24, 0, .045, .65, -.65, 3600, 240, "bandpass"]] },
  "orbit-complete": { major: 1, tones: [[392, 392, .24, 0, "sine", .14, -.4, 2200, 3600], [523, 523, .3, .14, "sine", .15, 0, 3200, 4800], [659, 622, .42, .3, "sine", .14, .4, 4200, 3600]], noise: [[.46, .18, .02, -.5, .5, 4200, 7800, "highpass"]], echo: [.18, .2] },
  "constellation-complete": { major: 1, tones: [[262, 262, .3, 0, "sine", .14, -.6, 1400, 2600], [392, 392, .32, .15, "sine", .15, -.2, 2200, 3600], [523, 523, .34, .31, "sine", .16, .2, 3200, 4800], [784, 698, .58, .48, "sine", .16, .6, 5200, 3600]], noise: [[.82, .18, .035, -.9, .9, 3200, 9800, "highpass"]], echo: [.2, .24] },
  "gate-open": { major: 1, tones: [[98, 132, .72, 0, "sine", .24, 0, 260, 680], [392, 622, .44, .18, "triangle", .1, .25, 1800, 5200]], noise: [[.54, .08, .04, -.6, .6, 420, 4800, "bandpass"]], echo: [.17, .2] },
  "reactor-dim": { tones: [[330, 156, .58, 0, "triangle", .18, .1, 1600, 280], [220, 132, .46, .08, "sine", .09, -.25, 820, 220]], noise: [[.4, .02, .032, .3, -.3, 1800, 220, "lowpass"]] },
  "deep-gong": { major: 1, tones: [[82, 76, 1.16, 0, "sine", .3, 0, 320, 180], [164, 152, .82, .04, "triangle", .13, -.25, 680, 260], [328, 304, .62, .08, "sine", .07, .25, 1200, 420]], noise: [[.54, 0, .04, -.3, .3, 1200, 220, "lowpass"]], echo: [.24, .25] },
  "belt-fanfare": { major: 1, tones: [[98, 196, 1.35, 0, "sine", .24, 0, 320, 1100], [392, 784, .42, .24, "triangle", .12, -.65, 1800, 6200], [523, 1047, .46, .52, "sine", .14, -.2, 2600, 8200], [784, 1568, .62, .84, "sine", .15, .45, 4200, 10800], [1047, 2093, .82, 1.25, "sine", .13, .7, 6200, 11800]], noise: [[1.8, .16, .065, -.95, .95, 620, 11800, "highpass"]], echo: [.19, .27] },
  "stellar-fanfare": { major: 1, tones: [[55, 132, 1.48, 0, "triangle", .3, 0, 220, 980], [262, 523, .42, .18, "sine", .12, -.7, 1600, 5200], [392, 784, .44, .52, "sine", .14, -.25, 2400, 7200], [523, 1047, .5, .88, "sine", .15, .3, 3600, 9200], [784, 1568, .72, 1.28, "sine", .16, .72, 5200, 11800]], noise: [[1.65, .12, .08, -.95, .95, 520, 12000, "highpass"]], echo: [.18, .28] },
  "terminal-lock": { major: 1, tones: [[880, 880, .24, 0, "sine", .17, -.25, 5200, 6200], [1175, 1047, .42, .12, "sine", .16, .25, 7200, 4800], [110, 82, .62, 0, "triangle", .17, 0, 420, 180]], echo: [.16, .2] },
  "reactor-shutdown": { major: 1, tones: [[294, 52, 1.32, 0, "triangle", .25, .25, 1400, 120], [302, 55, 1.42, .04, "sine", .11, -.25, 1200, 110], [440, 164, .72, .18, "sine", .055, .45, 2600, 420]], noise: [[1.18, 0, .06, .55, -.55, 4200, 120, "lowpass"]], echo: [.2, .22] },
  "orbit-close": { tones: [[392, 262, .46, 0, "sine", .12, .25, 2200, 720], [196, 131, .42, .08, "triangle", .1, -.25, 820, 260]], noise: [[.32, .04, .018, .3, -.3, 1800, 320, "lowpass"]] },
  "holo-open": { tones: [[420, 620, .18, 0, "sine", .09, -.25, 2600, 6200], [620, 520, .2, .09, "sine", .065, .25, 5200, 2400]], echo: [.1, .12] },
  "radar-blip": { tones: [[920, 780, .09, 0, "sine", .055, .35, 6200, 3200]], echo: [.11, .08] },
  "objective-tick": { major: 1, tones: [[620, 880, .13, 0, "sine", .12, -.3, 2600, 6800], [880, 1180, .12, .07, "sine", .085, .3, 4200, 8200]], echo: [.1, .14] },
  "patch-weave": { major: 1, tones: [[147, 110, .34, 0, "triangle", .22, 0, 820, 300], [523, 784, .26, .1, "sine", .14, -.3, 2600, 6200], [784, 988, .34, .24, "sine", .13, .35, 4200, 7600]], noise: [[.3, .08, .025, -.5, .5, 3200, 8600, "highpass"]], echo: [.15, .2] },
  "coin-mint": { major: 1, tones: [[988, 1319, .1, 0, "triangle", .12, .25, 4200, 9200], [1319, 1568, .16, .07, "sine", .1, -.2, 6200, 10400]], noise: [[.1, 0, .02, .4, -.4, 6800, 11200, "highpass"]], echo: [.09, .16] },
}

for (const cue of NG_SOUND_CATALOG) {
  const voice = NG_VOICES[cue.voice]
  if (!voice || (!(voice.tones || []).length && !(voice.noise || []).length)) {
    throw new Error(`[neural-sound] Cue "${cue.beat}" has no synthesis recipe`)
  }
}

const NG_PATCHES = Object.fromEntries(
  NG_SOUND_CATALOG.map((cue) => [cue.beat, { ...NG_VOICES[cue.voice], ...cue, id: cue.voice }]),
)

class NGSound {
  constructor(app) {
    this.app = app
    this.soundLog = []
    this._ctxCreated = false
    this._ctx = null
    this._lastVoice = -1e9
    this._lastByBeat = {}
    this._lastByVoice = {}
    this._scenePriority = 0
    this._sceneUntil = -1e9
    this._active = 0
    this._seed = 0x6e657572
    this._voiceTimers = []
    if (!app.isTest()) {
      this._unlock = () => this._ensureCtx()
      window.addEventListener("pointerdown", this._unlock, { once: true, passive: true })
      window.addEventListener("keydown", this._unlock, { once: true })
    }
  }

  enabled() {
    return this.app.get("sound", "on") !== "off"
  }

  volume() {
    const value = parseFloat(this.app.get("soundVolume", "0.5"))
    return Math.max(0, Math.min(1, Number.isNaN(value) ? 0.5 : value))
  }

  _rng() {
    if (typeof this.app.rng === "function") return this.app.rng("sfx")
    this._seed = (1664525 * this._seed + 1013904223) >>> 0
    return this._seed / 4294967296
  }

  _ensureCtx() {
    if (this.app.isTest() || this._ctx || this._destroyed) return
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return
      const ctx = new AudioContextClass({ latencyHint: "interactive" })
      const input = ctx.createGain()
      const compressor = ctx.createDynamicsCompressor()
      const master = ctx.createGain()
      compressor.threshold.value = -20
      compressor.knee.value = 14
      compressor.ratio.value = 5
      compressor.attack.value = 0.003
      compressor.release.value = 0.22
      master.gain.value = 0.64
      input.connect(compressor)
      compressor.connect(master)
      master.connect(ctx.destination)
      this._ctx = ctx
      this._input = input
      this._noise = this._noiseBuffer(ctx)
      this._ctxCreated = true
    } catch (error) {
      console.warn("[neural-sound] Audio engine unavailable", error)
    }
  }

  _noiseBuffer(ctx) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2), ctx.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let index = 0; index < samples.length; index++) samples[index] = this._rng() * 2 - 1
    return buffer
  }

  _route(source, gain, pan, filterStart, filterEnd, filterType, patch, at, duration) {
    const ctx = this._ctx
    let tail = gain
    source.connect(gain)
    if (filterStart) {
      const filter = ctx.createBiquadFilter()
      filter.type = filterType || "lowpass"
      filter.frequency.setValueAtTime(Math.max(40, filterStart), at)
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterEnd || filterStart), at + duration)
      tail.connect(filter)
      tail = filter
    }
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner()
      const startPan = Array.isArray(pan) ? pan[0] : pan || 0
      const endPan = Array.isArray(pan) ? pan[1] : startPan
      panner.pan.setValueAtTime(startPan, at)
      panner.pan.linearRampToValueAtTime(endPan, at + duration)
      tail.connect(panner)
      tail = panner
    }
    tail.connect(this._input)
    if (patch.echo) {
      const delay = ctx.createDelay(0.5)
      const feedback = ctx.createGain()
      delay.delayTime.value = patch.echo[0]
      feedback.gain.value = patch.echo[1]
      tail.connect(delay)
      delay.connect(feedback)
      feedback.connect(delay)
      delay.connect(this._input)
    }
  }

  _tone(note, patch, t0, master) {
    const [f0, f1, duration, delay, wave, peak, pan, filterStart, filterEnd] = note
    const at = t0 + delay
    const osc = this._ctx.createOscillator()
    const gain = this._ctx.createGain()
    const detune = (this._rng() - 0.5) * 5
    osc.type = wave
    osc.frequency.setValueAtTime(Math.max(20, f0 + detune), at)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + duration)
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.linearRampToValueAtTime(peak * master, at + Math.min(0.035, duration * 0.18))
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    this._route(osc, gain, pan, filterStart, filterEnd, "lowpass", patch, at, duration)
    osc.start(at)
    osc.stop(at + duration + 0.06)
    return delay + duration
  }

  _noiseVoice(note, patch, t0, master) {
    const [duration, delay, peak, panStart, panEnd, filterStart, filterEnd, filterType] = note
    const at = t0 + delay
    const source = this._ctx.createBufferSource()
    const gain = this._ctx.createGain()
    source.buffer = this._noise
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.linearRampToValueAtTime(peak * master, at + Math.min(0.06, duration * 0.2))
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration)
    this._route(source, gain, [panStart, panEnd], filterStart, filterEnd, filterType, patch, at, duration)
    source.start(at)
    source.stop(at + duration + 0.06)
    return delay + duration
  }

  _play(patch) {
    const ctx = this._ctx
    if (!ctx || ctx.state !== "running" || (this._active >= 6 && !patch.major)) return false
    const master = this.volume() * 0.5
    if (master <= 0) return false
    this._active++
    const t0 = ctx.currentTime + 0.01
    let longest = 0
    for (const note of patch.tones || []) longest = Math.max(longest, this._tone(note, patch, t0, master))
    for (const note of patch.noise || []) longest = Math.max(longest, this._noiseVoice(note, patch, t0, master))
    const timer = setTimeout(() => {
      this._active = Math.max(0, this._active - 1)
      this._voiceTimers = this._voiceTimers.filter((entry) => entry !== timer)
    }, (longest + (patch.echo?.[0] || 0) * 4 + 0.12) * 1000)
    this._voiceTimers.push(timer)
    return true
  }

  beat(name) {
    if (this._destroyed || !this.enabled()) return
    const patch = NG_PATCHES[name]
    if (!patch) return
    const now = typeof performance !== "undefined" ? performance.now() : 0
    if (now - (this._lastByBeat[name] || -1e9) < 100) return
    if (now - this._lastVoice < 40 && !patch.major) return
    this._lastByBeat[name] = now
    this._lastVoice = now
    if (this.app.isTest()) {
      this.soundLog.push({ t: this.app.now || 0, beat: name, patch: patch.id, volume: this.volume() })
      if (this.soundLog.length > 4000) this.soundLog.splice(0, 1000)
      return
    }
    if (name === "combo_big" && this._pendingComboTimer) {
      clearTimeout(this._pendingComboTimer)
      this._pendingComboTimer = null
    }
    if (now - (this._lastByVoice[patch.id] || -1e9) < 120) return
    if (patch.priority && now < this._sceneUntil && patch.priority < this._scenePriority) return
    if (patch.sceneMs) {
      this._scenePriority = patch.priority || 1
      this._sceneUntil = now + patch.sceneMs
    }
    this._lastByVoice[patch.id] = now
    if (name === "combo") {
      this._pendingComboTimer = setTimeout(() => {
        this._pendingComboTimer = null
        if (!this._destroyed) this._play(patch)
      }, 45)
      return
    }
    this._play(patch)
  }

  async preview(name) {
    const patch = NG_PATCHES[name]
    if (!patch || this._destroyed) return false
    this._ensureCtx()
    if (!this._ctx) return false
    if (this._ctx.state !== "running") {
      try {
        await this._ctx.resume()
      } catch {
        return false
      }
    }
    return this._play(patch)
  }

  stop() {
    if (this._pendingComboTimer) clearTimeout(this._pendingComboTimer)
    this._pendingComboTimer = null
    for (const timer of this._voiceTimers) clearTimeout(timer)
    this._voiceTimers = []
    this._active = 0
    try {
      if (this._ctx) this._ctx.close()
    } catch {
      // Closing is best-effort; the browser will release a detached context.
    }
    this._ctx = null
    this._input = null
    this._noise = null
  }

  destroy() {
    this._destroyed = true
    if (this._unlock) {
      window.removeEventListener("pointerdown", this._unlock)
      window.removeEventListener("keydown", this._unlock)
    }
    this.stop()
  }
}

globalThis.NG_SOUND_CATALOG = NG_SOUND_CATALOG
globalThis.NGSound = NGSound
