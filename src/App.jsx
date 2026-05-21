import { useState, useEffect, useRef, useCallback } from 'react'
import styles from './App.module.css'

import Header        from './components/Header'
import ScoreDisplay  from './components/ScoreDisplay'
import PianoKeyboard, { KB_MAP } from './components/PianoKeyboard'
import WelcomeScreen from './components/WelcomeScreen'
import ResultsModal  from './components/ResultsModal'

import { parseMusicXML } from './utils/musicxml'
import { SAMPLES } from './utils/samples'
import { usePiano }    from './hooks/usePiano'
import { usePractice } from './hooks/usePractice'

export default function App() {
  // ── Score state ───────────────────────────────────────────────
  const [parsedScore, setParsedScore] = useState(null)
  const [fileName, setFileName]       = useState('')
  const [showWelcome, setShowWelcome] = useState(true)
  const [bpm, setBpm]                 = useState(90)

  // ── Piano audio (Salamander samples + synth fallback) ─────────
  const { playNote, ready: audioReady, loading: audioLoading, usingSynth } = usePiano()

  // ── Practice / demo state machine ────────────────────────────
  const {
    mode, toast, expectedNote, activeNotes,
    correct, wrong, missed, score, accuracy, progress,
    showResults, setShowResults,
    startDemo, startPractice, stopAll, evaluateInput,
    setOnAdvance,
  } = usePractice({ playNote })

  // ── Score display refs ────────────────────────────────────────
  const noteXYRef      = useRef({})
  const currentNoteRef = useRef(null)

  // Wire cursor advance callback from practice/demo into ScoreDisplay
  const handleAdvance = useCallback((noteId) => {
    currentNoteRef.current = noteId
  }, [])
  useEffect(() => { setOnAdvance(handleAdvance) }, [setOnAdvance, handleAdvance])

  // ── Pressed keys visual state ─────────────────────────────────
  const [pressedKeys, setPressedKeys] = useState(new Set())
  const pressTimers = useRef({})

  const flashKey = useCallback((note, ms = 320) => {
    setPressedKeys(prev => new Set([...prev, note]))
    clearTimeout(pressTimers.current[note])
    pressTimers.current[note] = setTimeout(() =>
      setPressedKeys(prev => { const n = new Set(prev); n.delete(note); return n }), ms)
  }, [])

  // ── Load score ────────────────────────────────────────────────
  const loadScore = useCallback((xmlStr, name) => {
    try {
      stopAll()
      const parsed = parseMusicXML(xmlStr)
      setParsedScore(parsed)
      setFileName(name || parsed.title)
      setShowWelcome(false)
      if (parsed.tempoFromScore) setBpm(Math.round(parsed.tempoFromScore))
    } catch (e) {
      alert('Could not load score:\n' + e.message)
    }
  }, [stopAll])

  const loadSample = useCallback((key) => {
    if (SAMPLES[key]) loadScore(SAMPLES[key], key + '.xml')
  }, [loadScore])

  // ── Handle note input ─────────────────────────────────────────
  const handleNoteInput = useCallback((note) => {
    if (!note) return
    flashKey(note, 320)
    if (mode === 'practice') {
      evaluateInput(note)
    } else {
      playNote(note, 0.45)
    }
  }, [mode, evaluateInput, playNote, flashKey])

  // ── Keyboard input ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.repeat) return
      if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return
      const note = KB_MAP[e.key.toLowerCase()]
      if (note) handleNoteInput(note)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleNoteInput])

  // ── Demo / practice wrappers ──────────────────────────────────
  const handleStartDemo = useCallback(() => {
    if (!parsedScore) { alert('Load a score first.'); return }
    startDemo(parsedScore, bpm)
  }, [parsedScore, bpm, startDemo])

  const handleStartPractice = useCallback(() => {
    if (!parsedScore) { alert('Load a score first.'); return }
    startPractice(parsedScore)
  }, [parsedScore, startPractice])

  // ── Stats for header ──────────────────────────────────────────
  const displayStats = (correct + wrong + missed) > 0
    ? { correct, wrong, missed, accuracy, progress }
    : null

  // ── Audio loading indicator ───────────────────────────────────
  const audioStatus = audioLoading ? '⏳ Loading piano...'
    : usingSynth ? '🎹 Synth mode' : null

  return (
    <div className={styles.app}>
      <Header
        fileName={fileName}
        mode={mode}
        bpm={bpm}
        stats={displayStats}
        audioStatus={audioStatus}
        onLoadFile={loadScore}
        onDemo={handleStartDemo}
        onPractice={handleStartPractice}
        onStop={stopAll}
        onBpmChange={setBpm}
      />

      <div className={styles.scoreWrapper}>
        {showWelcome && (
          <WelcomeScreen onLoadSample={loadSample} onFileLoad={loadScore} />
        )}
        <ScoreDisplay
          parsedScore={parsedScore}
          mode={mode}
          activeNotes={activeNotes}
          noteXYRef={noteXYRef}
          currentNoteRef={currentNoteRef}
        />
      </div>

      {/* Expected note panel */}
      {mode === 'practice' && expectedNote && (
        <div className={styles.nextNote}>
          <div className={styles.nextNoteName}>{expectedNote.note}</div>
          <div className={styles.nextNoteLbl}>PLAY THIS NOTE</div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${styles['toast_' + toast.type]}`}>
          {toast.msg}
        </div>
      )}

      <PianoKeyboard
        pressedKeys={pressedKeys}
        expectedKey={expectedNote?.note || null}
        onNoteInput={handleNoteInput}
      />

      {showResults && (
        <ResultsModal
          stats={{ correct, wrong, missed, accuracy, score }}
          onClose={() => setShowResults(false)}
        />
      )}
    </div>
  )
}
