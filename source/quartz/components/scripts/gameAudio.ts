import { loadSettings } from "./settings"

export const GAME_SOUND_CATALOG = [
  {
    cue: "interface-on",
    label: "Interface online",
    group: "System",
    context: "Sound effects are enabled from Settings or this sound lab.",
    character: "A compact two-stage neural boot chirp.",
    durationMs: 420,
  },
  {
    cue: "roll",
    label: "Probability charge",
    group: "Gameplay",
    context: "A player selects a move and its probability roll begins.",
    character: "Electrical current accelerates through a spatial field.",
    durationMs: 480,
  },
  {
    cue: "move-success",
    label: "Move connected",
    group: "Gameplay",
    context: "The player's move roll succeeds before navigation to the technique.",
    character: "Three bright nodes connect in a rising neural pattern.",
    durationMs: 780,
  },
  {
    cue: "move-failure",
    label: "Move defended",
    group: "Gameplay",
    context: "The player's move is defended and no opponent turn follows.",
    character: "A damped connection folds downward without a harsh buzzer.",
    durationMs: 640,
  },
  {
    cue: "opponent-alert",
    label: "Opponent signal",
    group: "Gameplay",
    context: "The opponent-turn overlay opens and an attack is selected.",
    character: "A low radar bed with three directional scanning pulses.",
    durationMs: 820,
  },
  {
    cue: "opponent-hit",
    label: "Opponent advances",
    group: "Gameplay",
    context: "The opponent succeeds and changes position without ending the roll.",
    character: "A compressed impact drops into a low spatial resonance.",
    durationMs: 760,
  },
  {
    cue: "defend",
    label: "Defense held",
    group: "Gameplay",
    context: "The opponent fails, or no valid opponent move can be attempted.",
    character: "A bright shield shimmer sweeps across the stereo field.",
    durationMs: 620,
  },
  {
    cue: "reveal",
    label: "Answer revealed",
    group: "Learning",
    context: "A learner intentionally reveals a flashcard answer.",
    character: "A quiet unlock chirp; automatic session reveals stay silent.",
    durationMs: 260,
  },
  {
    cue: "correct",
    label: "Synapse connected",
    group: "Learning",
    context: "A flashcard is rated Hard or Easy without a larger milestone.",
    character: "A quick crystalline connection across three pitches.",
    durationMs: 520,
  },
  {
    cue: "incorrect",
    label: "Retry signal",
    group: "Learning",
    context: "A flashcard is rated Again and remains available to retry.",
    character: "A soft descending disconnect with a muted noise edge.",
    durationMs: 440,
  },
  {
    cue: "mastery",
    label: "Technique mastered",
    group: "Learning",
    context: "A technique crosses into the mastered SRS state.",
    character: "A low foundation blooms into a four-node constellation.",
    durationMs: 1280,
  },
  {
    cue: "session-start",
    label: "Session launch",
    group: "Training",
    context: "A new or resumed training queue begins navigation.",
    character: "A short warp field rises into two navigation beacons.",
    durationMs: 980,
  },
  {
    cue: "session-complete",
    label: "Session resolved",
    group: "Training",
    context: "The final technique in a training session is completed.",
    character: "A warm orbital chord resolves with two distant lights.",
    durationMs: 1120,
  },
  {
    cue: "daily-goal",
    label: "Daily orbit complete",
    group: "Training",
    context: "The first review that reaches today's goal, once per local day.",
    character: "A broad launch wash carries a five-note achievement arc.",
    durationMs: 1480,
  },
  {
    cue: "victory",
    label: "Star-jump victory",
    group: "Outcomes",
    context: "The game-over report opens with valid victory data.",
    character: "A full spatial launch builds through three ascending constellations.",
    durationMs: 2280,
  },
  {
    cue: "defeat",
    label: "Reactor shutdown",
    group: "Outcomes",
    context: "An opponent submission reaches the terminal game-over state.",
    character: "A deep power-down collapses with a distant harmonic tail.",
    durationMs: 1720,
  },
] as const

export type GameSoundCue = (typeof GAME_SOUND_CATALOG)[number]["cue"]
export type GameSoundGroup = (typeof GAME_SOUND_CATALOG)[number]["group"]

export const GAME_SOUND_CUES: readonly GameSoundCue[] = GAME_SOUND_CATALOG.map(({ cue }) => cue)

export interface GameSoundOptions {
  delay?: number
  preview?: boolean
}

interface GameAudioEngine {
  context: AudioContext
  input: GainNode
  master: GainNode
  noise: AudioBuffer
  lastPlayed: Partial<Record<GameSoundCue, number>>
  celebrationUntil: number
}

type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext

declare global {
  interface Window {
    webkitAudioContext?: AudioContextConstructor
    __bjjGameAudio?: GameAudioEngine
    __bjjGameAudioWarned?: boolean
  }
}

const MIN_GAIN = 0.0001
const cueCooldownMs: Partial<Record<GameSoundCue, number>> = {
  reveal: 90,
  correct: 120,
  incorrect: 120,
  roll: 250,
  "opponent-alert": 500,
  mastery: 1600,
  "session-start": 800,
  "session-complete": 1200,
  "daily-goal": 2500,
  victory: 4000,
  defeat: 3000,
}

function buildNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.ceil(context.sampleRate * 2)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const samples = buffer.getChannelData(0)

  for (let i = 0; i < length; i++) {
    samples[i] = Math.random() * 2 - 1
  }

  return buffer
}

function createEngine(): GameAudioEngine | null {
  const existing = window.__bjjGameAudio
  if (existing && existing.context.state !== "closed") return existing

  const Context = window.AudioContext ?? window.webkitAudioContext
  if (!Context) return null

  try {
    const context = new Context({ latencyHint: "interactive" })
    const input = context.createGain()
    const compressor = context.createDynamicsCompressor()
    const master = context.createGain()

    compressor.threshold.value = -20
    compressor.knee.value = 14
    compressor.ratio.value = 5
    compressor.attack.value = 0.003
    compressor.release.value = 0.2
    master.gain.value = 0.58

    input.connect(compressor)
    compressor.connect(master)
    master.connect(context.destination)

    const engine: GameAudioEngine = {
      context,
      input,
      master,
      noise: buildNoiseBuffer(context),
      lastPlayed: {},
      celebrationUntil: 0,
    }
    window.__bjjGameAudio = engine
    return engine
  } catch (error) {
    warnAudioFailure(error)
    return null
  }
}

function warnAudioFailure(error: unknown) {
  if (window.__bjjGameAudioWarned) return
  window.__bjjGameAudioWarned = true
  console.warn("Game audio could not start", error)
}

function route(
  engine: GameAudioEngine,
  node: AudioNode,
  at: number,
  duration: number,
  pan: number | readonly [number, number] = 0,
  echo = 0,
) {
  if (typeof engine.context.createStereoPanner !== "function") {
    node.connect(engine.input)
    return
  }

  const panner = engine.context.createStereoPanner()
  const startPan = typeof pan === "number" ? pan : pan[0]
  const endPan = typeof pan === "number" ? pan : pan[1]

  panner.pan.setValueAtTime(startPan, at)
  panner.pan.linearRampToValueAtTime(endPan, at + duration)
  node.connect(panner)
  panner.connect(engine.input)

  if (echo > 0) {
    const delay = engine.context.createDelay(0.6)
    const wet = engine.context.createGain()
    delay.delayTime.value = 0.16
    wet.gain.value = echo
    panner.connect(delay)
    delay.connect(wet)
    wet.connect(engine.input)
  }
}

interface ToneOptions {
  frequency: number
  endFrequency?: number
  duration: number
  gain: number
  attack?: number
  type?: OscillatorType
  filter?: number | readonly [number, number]
  filterType?: BiquadFilterType
  detune?: number
  pan?: number | readonly [number, number]
  echo?: number
}

function tone(engine: GameAudioEngine, at: number, options: ToneOptions) {
  const context = engine.context
  const oscillator = context.createOscillator()
  const filter = context.createBiquadFilter()
  const envelope = context.createGain()
  const attack = Math.min(options.attack ?? 0.015, options.duration * 0.4)
  const releaseAt = at + Math.max(attack + 0.01, options.duration * 0.55)
  const filterStart = typeof options.filter === "number" ? options.filter : options.filter?.[0]
  const filterEnd = typeof options.filter === "number" ? options.filter : options.filter?.[1]

  oscillator.type = options.type ?? "sine"
  oscillator.frequency.setValueAtTime(options.frequency, at)
  if (options.endFrequency && options.endFrequency !== options.frequency) {
    oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, at + options.duration)
  }
  oscillator.detune.value = options.detune ?? 0

  filter.type = options.filterType ?? "lowpass"
  filter.Q.value = 1.2
  filter.frequency.setValueAtTime(filterStart ?? 12000, at)
  if (filterEnd && filterEnd !== filterStart) {
    filter.frequency.exponentialRampToValueAtTime(filterEnd, at + options.duration)
  }

  envelope.gain.setValueAtTime(MIN_GAIN, at)
  envelope.gain.exponentialRampToValueAtTime(options.gain, at + attack)
  envelope.gain.setValueAtTime(options.gain, releaseAt)
  envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, at + options.duration)

  oscillator.connect(filter)
  filter.connect(envelope)
  route(engine, envelope, at, options.duration, options.pan, options.echo)
  oscillator.start(at)
  oscillator.stop(at + options.duration + 0.03)
}

interface NoiseOptions {
  duration: number
  gain: number
  attack?: number
  filter: number | readonly [number, number]
  filterType?: BiquadFilterType
  pan?: number | readonly [number, number]
  echo?: number
}

function noise(engine: GameAudioEngine, at: number, options: NoiseOptions) {
  const context = engine.context
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const envelope = context.createGain()
  const attack = Math.min(options.attack ?? 0.008, options.duration * 0.35)
  const filterStart = typeof options.filter === "number" ? options.filter : options.filter[0]
  const filterEnd = typeof options.filter === "number" ? options.filter : options.filter[1]

  source.buffer = engine.noise
  filter.type = options.filterType ?? "bandpass"
  filter.Q.value = 1.6
  filter.frequency.setValueAtTime(filterStart, at)
  filter.frequency.exponentialRampToValueAtTime(filterEnd, at + options.duration)

  envelope.gain.setValueAtTime(MIN_GAIN, at)
  envelope.gain.exponentialRampToValueAtTime(options.gain, at + attack)
  envelope.gain.exponentialRampToValueAtTime(MIN_GAIN, at + options.duration)

  source.connect(filter)
  filter.connect(envelope)
  route(engine, envelope, at, options.duration, options.pan, options.echo)
  source.start(at, Math.random() * 0.5, options.duration)
  source.stop(at + options.duration + 0.03)
}

function arpeggio(
  engine: GameAudioEngine,
  at: number,
  frequencies: readonly number[],
  step: number,
  gain: number,
  duration = 0.42,
) {
  frequencies.forEach((frequency, index) => {
    tone(engine, at + index * step, {
      frequency,
      endFrequency: frequency * 1.012,
      duration,
      gain,
      type: index % 2 === 0 ? "sine" : "triangle",
      filter: 4200,
      pan: -0.45 + (index / Math.max(1, frequencies.length - 1)) * 0.9,
      echo: 0.22,
    })
  })
}

const recipes: Record<GameSoundCue, (engine: GameAudioEngine, at: number) => void> = {
  "interface-on": (engine, at) => {
    tone(engine, at, {
      frequency: 320,
      endFrequency: 720,
      duration: 0.24,
      gain: 0.07,
      type: "triangle",
      filter: [1800, 5200],
      echo: 0.12,
    })
    tone(engine, at + 0.08, {
      frequency: 1080,
      endFrequency: 1440,
      duration: 0.22,
      gain: 0.035,
      pan: 0.25,
      echo: 0.18,
    })
  },
  roll: (engine, at) => {
    noise(engine, at, {
      duration: 0.36,
      gain: 0.085,
      filter: [450, 6400],
      filterType: "highpass",
      pan: [-0.5, 0.5],
    })
    tone(engine, at, {
      frequency: 72,
      endFrequency: 310,
      duration: 0.42,
      gain: 0.11,
      type: "sawtooth",
      filter: [700, 2400],
      pan: [-0.25, 0.25],
    })
    ;[360, 520, 760].forEach((frequency, index) => {
      tone(engine, at + 0.07 + index * 0.07, {
        frequency,
        endFrequency: frequency * 1.25,
        duration: 0.12,
        gain: 0.032,
        type: "triangle",
        pan: index - 1,
      })
    })
  },
  "move-success": (engine, at) => {
    arpeggio(engine, at, [392, 587.33, 880], 0.075, 0.058, 0.5)
    noise(engine, at + 0.09, {
      duration: 0.24,
      gain: 0.035,
      filter: [1800, 7200],
      filterType: "highpass",
      pan: [-0.3, 0.45],
      echo: 0.12,
    })
  },
  "move-failure": (engine, at) => {
    tone(engine, at, {
      frequency: 246,
      endFrequency: 108,
      duration: 0.52,
      gain: 0.075,
      type: "triangle",
      filter: [1500, 520],
      pan: [0.15, -0.2],
    })
    tone(engine, at + 0.04, {
      frequency: 174,
      endFrequency: 82,
      duration: 0.58,
      gain: 0.045,
      detune: -9,
      filter: [900, 320],
    })
  },
  "opponent-alert": (engine, at) => {
    tone(engine, at, {
      frequency: 92,
      endFrequency: 142,
      duration: 0.78,
      gain: 0.06,
      type: "triangle",
      filter: 700,
    })
    ;[0.7, 0, -0.7].forEach((pan, index) => {
      tone(engine, at + index * 0.13, {
        frequency: 330,
        endFrequency: 660,
        duration: 0.19,
        gain: 0.045 - index * 0.006,
        pan,
        echo: 0.08,
      })
    })
  },
  "opponent-hit": (engine, at) => {
    noise(engine, at, {
      duration: 0.18,
      gain: 0.1,
      filter: [900, 180],
      filterType: "lowpass",
      pan: [0.35, -0.1],
    })
    tone(engine, at, {
      frequency: 112,
      endFrequency: 58,
      duration: 0.68,
      gain: 0.12,
      type: "triangle",
      filter: [700, 240],
    })
    tone(engine, at + 0.05, {
      frequency: 230,
      endFrequency: 148,
      duration: 0.46,
      gain: 0.045,
      detune: 8,
      pan: -0.25,
    })
  },
  defend: (engine, at) => {
    noise(engine, at, {
      duration: 0.32,
      gain: 0.05,
      filter: [1100, 6800],
      filterType: "highpass",
      pan: [-0.55, 0.55],
      echo: 0.14,
    })
    tone(engine, at, {
      frequency: 620,
      endFrequency: 960,
      duration: 0.34,
      gain: 0.052,
      type: "triangle",
      pan: [-0.35, 0.25],
      echo: 0.2,
    })
    tone(engine, at + 0.06, {
      frequency: 930,
      endFrequency: 1395,
      duration: 0.38,
      gain: 0.032,
      pan: [0.3, -0.15],
      echo: 0.22,
    })
  },
  reveal: (engine, at) => {
    tone(engine, at, {
      frequency: 420,
      endFrequency: 840,
      duration: 0.15,
      gain: 0.035,
      type: "triangle",
      filter: [1800, 5200],
      pan: -0.15,
    })
    tone(engine, at + 0.045, {
      frequency: 1260,
      endFrequency: 1540,
      duration: 0.14,
      gain: 0.018,
      pan: 0.2,
      echo: 0.1,
    })
  },
  correct: (engine, at) => {
    arpeggio(engine, at, [523.25, 783.99, 1046.5], 0.06, 0.04, 0.32)
  },
  incorrect: (engine, at) => {
    tone(engine, at, {
      frequency: 276,
      endFrequency: 184,
      duration: 0.36,
      gain: 0.052,
      type: "triangle",
      filter: [1300, 620],
    })
    noise(engine, at, {
      duration: 0.11,
      gain: 0.024,
      filter: [1200, 540],
      filterType: "lowpass",
      pan: 0.1,
    })
  },
  mastery: (engine, at) => {
    tone(engine, at, {
      frequency: 82,
      endFrequency: 164,
      duration: 0.82,
      gain: 0.055,
      type: "triangle",
      filter: [500, 1100],
    })
    arpeggio(engine, at + 0.08, [440, 659.25, 880, 1174.66], 0.11, 0.052, 0.72)
  },
  "session-start": (engine, at) => {
    noise(engine, at, {
      duration: 0.58,
      gain: 0.055,
      filter: [380, 5600],
      filterType: "highpass",
      pan: [-0.65, 0.65],
    })
    tone(engine, at, {
      frequency: 74,
      endFrequency: 222,
      duration: 0.62,
      gain: 0.08,
      type: "triangle",
      filter: [620, 1900],
    })
    arpeggio(engine, at + 0.32, [440, 660], 0.09, 0.035, 0.38)
  },
  "session-complete": (engine, at) => {
    ;[293.66, 440, 587.33].forEach((frequency, index) => {
      tone(engine, at + index * 0.035, {
        frequency,
        endFrequency: frequency * 1.01,
        duration: 0.88,
        gain: 0.042,
        type: index === 1 ? "triangle" : "sine",
        pan: -0.35 + index * 0.35,
        echo: 0.2,
      })
    })
    arpeggio(engine, at + 0.2, [880, 1174.66], 0.12, 0.025, 0.46)
  },
  "daily-goal": (engine, at) => {
    tone(engine, at, {
      frequency: 65,
      endFrequency: 130,
      duration: 1.25,
      gain: 0.075,
      type: "triangle",
      filter: [480, 1200],
    })
    noise(engine, at + 0.06, {
      duration: 0.78,
      gain: 0.05,
      filter: [900, 7600],
      filterType: "highpass",
      pan: [-0.75, 0.75],
      echo: 0.1,
    })
    arpeggio(engine, at + 0.12, [392, 523.25, 659.25, 783.99, 1046.5], 0.1, 0.045, 0.72)
  },
  victory: (engine, at) => {
    noise(engine, at, {
      duration: 1.08,
      gain: 0.085,
      attack: 0.12,
      filter: [320, 8400],
      filterType: "highpass",
      pan: [-0.9, 0.9],
      echo: 0.12,
    })
    tone(engine, at, {
      frequency: 55,
      endFrequency: 130,
      duration: 1.5,
      gain: 0.11,
      type: "triangle",
      filter: [420, 1300],
    })
    arpeggio(engine, at + 0.2, [261.63, 392, 523.25], 0.06, 0.045, 0.8)
    arpeggio(engine, at + 0.58, [329.63, 493.88, 659.25], 0.06, 0.045, 0.82)
    arpeggio(engine, at + 0.98, [392, 587.33, 783.99, 1046.5], 0.07, 0.048, 0.9)
  },
  defeat: (engine, at) => {
    noise(engine, at, {
      duration: 1.15,
      gain: 0.065,
      attack: 0.05,
      filter: [4200, 260],
      filterType: "lowpass",
      pan: [0.5, -0.5],
    })
    tone(engine, at, {
      frequency: 147,
      endFrequency: 52,
      duration: 1.35,
      gain: 0.105,
      type: "triangle",
      filter: [980, 210],
      pan: [0.2, -0.2],
      echo: 0.08,
    })
    tone(engine, at + 0.05, {
      frequency: 151,
      endFrequency: 55,
      duration: 1.42,
      gain: 0.05,
      detune: -13,
      filter: [720, 180],
      pan: [-0.2, 0.2],
    })
    tone(engine, at + 0.2, {
      frequency: 440,
      endFrequency: 176,
      duration: 0.82,
      gain: 0.028,
      pan: 0.35,
      echo: 0.16,
    })
  },
}

export function playGameSound(cue: GameSoundCue, options: GameSoundOptions = {}) {
  if (
    typeof window === "undefined" ||
    document.visibilityState === "hidden" ||
    !loadSettings().soundEnabled
  ) {
    return
  }

  const engine = createEngine()
  if (!engine) return

  const now = performance.now()
  const cooldown = cueCooldownMs[cue] ?? 70
  if (!options.preview && now - (engine.lastPlayed[cue] ?? -Infinity) < cooldown) return
  if (!options.preview && cue === "session-complete" && now < engine.celebrationUntil) return

  engine.lastPlayed[cue] = now
  if (
    !options.preview &&
    (cue === "mastery" || cue === "daily-goal" || cue === "victory" || cue === "defeat")
  ) {
    engine.celebrationUntil = now + 1800
  }

  const schedule = () => {
    try {
      const at = engine.context.currentTime + Math.max(0, options.delay ?? 0) + 0.01
      recipes[cue](engine, at)
    } catch (error) {
      warnAudioFailure(error)
    }
  }

  if (engine.context.state === "running") {
    schedule()
    return
  }

  const activation = navigator.userActivation
  if (activation && !activation.hasBeenActive) return
  engine.context.resume().then(schedule).catch(warnAudioFailure)
}

export function stopGameSounds() {
  const engine = window.__bjjGameAudio
  if (!engine) return
  delete window.__bjjGameAudio
  engine.context.close().catch(warnAudioFailure)
}
