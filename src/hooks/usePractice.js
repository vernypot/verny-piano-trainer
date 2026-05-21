/**
 * usePractice.js
 * Practice session state machine.
 * Manages step-through note evaluation, scoring, and demo playback.
 */
import { useState, useRef, useCallback } from 'react'

const MAX_MISSES = 3

export function usePractice({ playNote }) {
  const [mode, setMode]               = useState('idle') // idle | demo | practice
  const [correct, setCorrect]         = useState(0)
  const [wrong, setWrong]             = useState(0)
  const [missed, setMissed]           = useState(0)
  const [practiceIdx, setPracticeIdx] = useState(0)
  const [queueLen, setQueueLen]       = useState(0)
  const [toast, setToast]             = useState(null)   // {msg, type}
  const [showResults, setShowResults] = useState(false)
  const [activeNotes, setActiveNotes] = useState({})     // noteId → colorString
  const [expectedNote, setExpectedNote] = useState(null) // {id, note}

  const queueRef       = useRef([])
  const idxRef         = useRef(0)
  const wrongCountRef  = useRef(0)
  const correctRef     = useRef(0)
  const wrongRef       = useRef(0)
  const missedRef      = useRef(0)
  const demoTimersRef  = useRef([])
  const modeRef        = useRef('idle')
  const onAdvanceRef   = useRef(null)
  const toastTimerRef  = useRef(null)

  // ── Toast ────────────────────────────────────────────────────
  const showToast = useCallback((msg, type, ms = 900) => {
    setToast({ msg, type })
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), ms)
  }, [])

  // ── Stop all ─────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    modeRef.current = 'idle'
    setMode('idle')
    demoTimersRef.current.forEach(clearTimeout)
    demoTimersRef.current = []
    setExpectedNote(null)
    setActiveNotes({})
  }, [])

  // ── Reset counters ───────────────────────────────────────────
  const resetCounters = useCallback(() => {
    correctRef.current = 0; wrongRef.current = 0; missedRef.current = 0
    setCorrect(0); setWrong(0); setMissed(0)
    setPracticeIdx(0)
  }, [])

  // ── Build practice queue from parsedScore (treble = parts[0]) ─
  function buildQueue(parsedScore) {
    const queue    = []
    const measures = parsedScore.parts[0]?.measures || []
    for (let mi = 0; mi < measures.length; mi++) {
      const meas = measures[mi]
      for (let ni = 0; ni < meas.notes.length; ni++) {
        const note = meas.notes[ni]
        if (note.isRest || note.isChord || !note.noteName) continue
        queue.push({ id: `n_${mi}_${ni}`, note: note.noteName })
      }
    }
    return queue
  }

  // ── Build timeline for demo ───────────────────────────────────
  function buildTimeline(parsedScore, bpm) {
    const spb  = 60 / bpm
    const tl   = []
    let   msb  = 0
    // Use all parts for demo (play full grand staff)
    for (const part of parsedScore.parts) {
      let partMsb = 0
      for (let mi = 0; mi < part.measures.length; mi++) {
        const meas = part.measures[mi]
        for (let ni = 0; ni < meas.notes.length; ni++) {
          const note = meas.notes[ni]
          if (note.isRest || note.isChord || !note.noteName) continue
          tl.push({
            id:      `n_${mi}_${ni}`,
            note:    note.noteName,
            startMs: (partMsb + note.startBeat) * spb * 1000,
            durMs:   note.duration * spb * 1000,
          })
        }
        partMsb += meas.beats
      }
    }
    tl.sort((a, b) => a.startMs - b.startMs)
    return tl
  }

  // ── DEMO MODE ────────────────────────────────────────────────
  const startDemo = useCallback((parsedScore, bpm) => {
    stopAll()
    modeRef.current = 'demo'
    setMode('demo')
    setActiveNotes({})

    const timeline = buildTimeline(parsedScore, bpm)
    let lastId = null
    const timers = []

    for (const ev of timeline) {
      const t = setTimeout(() => {
        if (modeRef.current !== 'demo') return
        playNote(ev.note, ev.durMs / 1000 * 0.85)
        setActiveNotes(prev => {
          const next = { ...prev }
          if (lastId) next[lastId] = '#c8bfaf'  // dim previous
          next[ev.id] = '#c8956e'               // orange-gold active
          lastId = ev.id
          return next
        })
        onAdvanceRef.current?.(ev.id)
      }, ev.startMs)
      timers.push(t)
    }

    if (timeline.length) {
      const last = timeline[timeline.length - 1]
      const end  = setTimeout(() => stopAll(), last.startMs + last.durMs + 1200)
      timers.push(end)
    }
    demoTimersRef.current = timers
  }, [playNote, stopAll])

  // ── PRACTICE MODE ────────────────────────────────────────────
  const startPractice = useCallback((parsedScore) => {
    stopAll()
    resetCounters()
    modeRef.current = 'practice'
    setMode('practice')
    setShowResults(false)
    setActiveNotes({})

    const queue = buildQueue(parsedScore)
    queueRef.current     = queue
    idxRef.current       = 0
    wrongCountRef.current = 0
    setQueueLen(queue.length)

    if (!queue.length) { stopAll(); return }
    advanceTo(0, queue)
  }, [stopAll, resetCounters])

  // Advance to given index
  function advanceTo(idx, queue) {
    const q = queue || queueRef.current
    if (idx >= q.length) { finishPractice(); return }
    const ev = q[idx]
    idxRef.current = idx
    setPracticeIdx(idx)
    wrongCountRef.current = 0
    setExpectedNote(ev)
    setActiveNotes(prev => {
      const next = { ...prev }
      // Dim any previously blue-highlighted note
      for (const k of Object.keys(next)) {
        if (next[k] === '#4a90d9') next[k] = '#c8bfaf'
      }
      next[ev.id] = '#4a90d9'  // blue = target
      return next
    })
    onAdvanceRef.current?.(ev.id)
  }

  // ── Evaluate user input ───────────────────────────────────────
  const evaluateInput = useCallback((noteName) => {
    if (modeRef.current !== 'practice') return
    const ev = queueRef.current[idxRef.current]
    if (!ev) return

    if (noteName === ev.note) {
      // ✅ Correct
      correctRef.current++
      setCorrect(c => c + 1)
      wrongCountRef.current = 0
      setActiveNotes(prev => ({ ...prev, [ev.id]: '#5cb87a' }))  // green
      showToast('✓  CORRECT', 'hit', 620)
      playNote(noteName, 0.4)
      const nextIdx = idxRef.current + 1
      setTimeout(() => {
        setActiveNotes(prev => ({ ...prev, [ev.id]: '#c8bfaf' }))  // dim
        if (modeRef.current === 'practice') advanceTo(nextIdx)
      }, 380)

    } else {
      // ❌ Wrong
      wrongRef.current++
      setWrong(w => w + 1)
      wrongCountRef.current++
      playNote(noteName, 0.22)
      showToast(`✗  WRONG  (need: ${ev.note})`, 'miss', 1100)

      if (wrongCountRef.current >= MAX_MISSES) {
        // Reclassify last wrong as skipped
        wrongRef.current--
        setWrong(w => w - 1)
        missedRef.current++
        setMissed(m => m + 1)
        setActiveNotes(prev => ({ ...prev, [ev.id]: '#c85c5c' }))  // red
        setTimeout(() => playNote(ev.note, 0.55), 180)
        showToast(`→  SKIPPED  (was: ${ev.note})`, 'wrong', 1400)
        wrongCountRef.current = 0
        const nextIdx = idxRef.current + 1
        setTimeout(() => {
          setActiveNotes(prev => ({ ...prev, [ev.id]: '#c8bfaf' }))
          if (modeRef.current === 'practice') advanceTo(nextIdx)
        }, 850)
      }
    }
  }, [playNote, showToast])

  function finishPractice() {
    modeRef.current = 'idle'
    setMode('idle')
    setExpectedNote(null)
    setShowResults(true)
  }

  // ── Expose cursor advance setter ─────────────────────────────
  const setOnAdvance = useCallback((fn) => { onAdvanceRef.current = fn }, [])

  const total    = correctRef.current + wrongRef.current + missedRef.current
  const score    = Math.max(0, Math.round(correctRef.current * 100 - wrongRef.current * 30 - missedRef.current * 50))
  const accuracy = total > 0 ? Math.round(correctRef.current / total * 100) + '%' : '—'
  const progress = queueLen > 0 ? Math.round(practiceIdx / queueLen * 100) + '%' : '—'

  return {
    mode, toast, expectedNote, activeNotes,
    correct, wrong, missed, score, accuracy, progress,
    showResults, setShowResults,
    startDemo, startPractice, stopAll, evaluateInput,
    setOnAdvance,
  }
}
