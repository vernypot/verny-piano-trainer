/**
 * Audio Engine — Tone.js based piano synthesizer
 * Uses a layered PolySynth with custom piano-like envelope and effects chain.
 * Much richer sound than a plain triangle oscillator.
 */
import * as Tone from 'tone'

let synth = null
let reverb = null
let compressor = null
let initialized = false

export async function initAudio() {
  if (initialized) return
  await Tone.start()

  // Compressor to prevent clipping
  compressor = new Tone.Compressor({
    threshold: -18, ratio: 4, attack: 0.005, release: 0.1,
  })

  // Convolution-style reverb for natural room sound
  reverb = new Tone.Reverb({
    decay: 2.2,
    wet: 0.28,
    preDelay: 0.01,
  })
  await reverb.generate()

  // Tremolo for gentle warmth variation (very subtle)
  const tremolo = new Tone.Tremolo({ frequency: 3.5, depth: 0.04 }).start()

  // EQ to shape the piano tone
  const eq = new Tone.EQ3({ low: 2, mid: -1, high: -3 })

  // PolySynth with a piano-like patch:
  // Layered FM synthesis approach - AmplitudeEnvelope over FMSynth
  synth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.01,
    modulationIndex: 14,
    oscillator: { type: 'sine' },
    envelope: {
      attack:  0.002,
      decay:   0.8,
      sustain: 0.05,
      release: 1.6,
    },
    modulation: { type: 'square' },
    modulationEnvelope: {
      attack:  0.002,
      decay:   0.35,
      sustain: 0.0,
      release: 0.4,
    },
    volume: -8,
  })

  // Chain: synth → tremolo → eq → compressor → reverb → output
  synth.connect(tremolo)
  tremolo.connect(eq)
  eq.connect(compressor)
  compressor.connect(reverb)
  reverb.toDestination()

  initialized = true
}

/**
 * Play a note with a piano-like sound.
 * @param {string} note  e.g. "C4", "F#3"
 * @param {number} durSec  duration in seconds
 * @param {number} velocity  0..1
 */
export function playNote(note, durSec = 0.45, velocity = 0.75) {
  if (!synth) return
  try {
    // Normalize note name for Tone.js (uses scientific pitch: C4, etc.)
    const toneName = toToneName(note)
    const velDb = Tone.gainToDb(Math.max(0.01, Math.min(1, velocity)))
    synth.triggerAttackRelease(toneName, Math.max(0.05, durSec), Tone.now(), velocity)
  } catch (e) {
    // Silently ignore out-of-range notes
  }
}

/**
 * Converts our internal note format (C#4) to Tone.js format (C#4 — same, but validate).
 */
function toToneName(note) {
  // Tone.js accepts C4, C#4, Db4 etc. Our format already uses sharps.
  return note
}

export function getInitialized() { return initialized }
