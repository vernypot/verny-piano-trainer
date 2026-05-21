/**
 * usePiano.js
 * Tone.js-powered piano sampler hook.
 * Uses Salamander Grand Piano samples from a public CDN for realistic sound.
 * Falls back to a synthesized piano if samples fail to load.
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import * as Tone from 'tone'

// Salamander Grand Piano sample URLs (hosted on GitHub via unpkg/CDN)
// We use a subset of velocities for fast loading
const SAMPLE_BASE = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_grand_piano-mp3/'

// Map of available sample notes → we'll use these as roots for the sampler
const SAMPLE_NOTES = {
  'A0':  `${SAMPLE_BASE}A0.mp3`,
  'C1':  `${SAMPLE_BASE}C1.mp3`,
  'D#1': `${SAMPLE_BASE}Ds1.mp3`,
  'F#1': `${SAMPLE_BASE}Fs1.mp3`,
  'A1':  `${SAMPLE_BASE}A1.mp3`,
  'C2':  `${SAMPLE_BASE}C2.mp3`,
  'D#2': `${SAMPLE_BASE}Ds2.mp3`,
  'F#2': `${SAMPLE_BASE}Fs2.mp3`,
  'A2':  `${SAMPLE_BASE}A2.mp3`,
  'C3':  `${SAMPLE_BASE}C3.mp3`,
  'D#3': `${SAMPLE_BASE}Ds3.mp3`,
  'F#3': `${SAMPLE_BASE}Fs3.mp3`,
  'A3':  `${SAMPLE_BASE}A3.mp3`,
  'C4':  `${SAMPLE_BASE}C4.mp3`,
  'D#4': `${SAMPLE_BASE}Ds4.mp3`,
  'F#4': `${SAMPLE_BASE}Fs4.mp3`,
  'A4':  `${SAMPLE_BASE}A4.mp3`,
  'C5':  `${SAMPLE_BASE}C5.mp3`,
  'D#5': `${SAMPLE_BASE}Ds5.mp3`,
  'F#5': `${SAMPLE_BASE}Fs5.mp3`,
  'A5':  `${SAMPLE_BASE}A5.mp3`,
  'C6':  `${SAMPLE_BASE}C6.mp3`,
  'D#6': `${SAMPLE_BASE}Ds6.mp3`,
  'F#6': `${SAMPLE_BASE}Fs6.mp3`,
  'A6':  `${SAMPLE_BASE}A6.mp3`,
  'C7':  `${SAMPLE_BASE}C7.mp3`,
}

export function usePiano() {
  const samplerRef  = useRef(null)
  const synthRef    = useRef(null)
  const [ready, setReady]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [usingSynth, setUsingSynth] = useState(false)

  // Build fallback synth piano
  function buildSynth() {
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.008, decay: 0.4, sustain: 0.3, release: 1.2 },
    })
    // Mild reverb for warmth
    const reverb = new Tone.Reverb({ decay: 1.8, wet: 0.25 }).toDestination()
    const eq = new Tone.EQ3({ low: 4, mid: 0, high: -2 }).connect(reverb)
    synth.connect(eq)
    synthRef.current = synth
    setUsingSynth(true)
    setReady(true)
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    let cancelled = false

    const sampler = new Tone.Sampler({
      urls: SAMPLE_NOTES,
      release: 1.2,
      onload: () => {
        if (cancelled) return
        // Add reverb for natural room feel
        const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.18 }).toDestination()
        const comp   = new Tone.Compressor(-18, 4).connect(reverb)
        sampler.connect(comp)
        samplerRef.current = sampler
        setReady(true)
        setLoading(false)
      },
      onerror: () => {
        if (cancelled) return
        console.warn('Piano samples failed to load — using synthesizer fallback')
        buildSynth()
      },
    })

    // Timeout: if samples take > 8s, fall back to synth
    const timeout = setTimeout(() => {
      if (!ready && !cancelled) {
        console.warn('Sample load timeout — using synth fallback')
        sampler.dispose()
        buildSynth()
      }
    }, 8000)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      sampler.dispose()
      samplerRef.current = null
    }
  }, [])

  const playNote = useCallback(async (noteName, duration = 0.5) => {
    try {
      await Tone.start()
      const instrument = samplerRef.current || synthRef.current
      if (!instrument) return
      // Tone.js note format: C4, D#3, etc.
      const toneNote = noteName.replace('A#', 'Bb') // Tone prefers flats
      instrument.triggerAttackRelease(toneNote, Math.max(0.1, duration))
    } catch (e) {
      // ignore audio context errors
    }
  }, [])

  const stopAll = useCallback(() => {
    try {
      const instrument = samplerRef.current || synthRef.current
      if (instrument) instrument.releaseAll?.()
    } catch(e) {}
  }, [])

  return { playNote, stopAll, ready, loading, usingSynth }
}
