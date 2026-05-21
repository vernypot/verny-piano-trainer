import { useEffect, useRef } from 'react'
import styles from './PianoKeyboard.module.css'

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const WHITE_W    = 36
const START_OCT  = 2
const N_OCT      = 5  // C2..B6 + C7 — full 61-key range

export const KB_MAP = {
  'a':'C3','w':'C#3','s':'D3','e':'D#3','d':'E3','f':'F3','t':'F#3','g':'G3',
  'y':'G#3','h':'A3','u':'A#3','j':'B3','k':'C4','o':'C#4','l':'D4','p':'D#4',
  ';':'E4',"'":'F4','z':'G4','x':'A4','c':'A#4','v':'B4','b':'C5','n':'C#5',
  'm':'D5',',':'D#5','.':'E5','/':'F5',
}

// Build note list
const buildNotes = () => {
  const notes = []
  for (let o = START_OCT; o < START_OCT + N_OCT; o++)
    for (const n of NOTE_NAMES) notes.push(n + o)
  notes.push('C' + (START_OCT + N_OCT))
  return notes
}

export const ALL_NOTES   = buildNotes()
export const WHITE_NOTES = ALL_NOTES.filter(n => !n.includes('#'))

export default function PianoKeyboard({ pressedKeys, expectedKey, onNoteInput }) {
  const containerRef = useRef(null)

  // Build keys
  const whiteKeys = []
  const blackKeys = []
  let wc = 0

  for (let i = 0; i < ALL_NOTES.length; i++) {
    const note = ALL_NOTES[i]
    if (!note.includes('#')) {
      whiteKeys.push({ note, idx: wc })
      wc++
    } else {
      const prevIdx = whiteKeys.length - 1
      blackKeys.push({ note, prevIdx })
    }
  }

  const totalWidth = wc * WHITE_W

  const getKeyClass = (note, isBlack) => {
    const classes = [isBlack ? styles.blackKey : styles.whiteKey]
    if (pressedKeys?.has(note))  classes.push(styles.pressed)
    if (expectedKey === note)    classes.push(styles.expected)
    return classes.join(' ')
  }

  return (
    <div className={styles.wrap} ref={containerRef}>
      <div className={styles.piano} style={{ width: totalWidth }}>
        {/* White keys */}
        {whiteKeys.map(({ note, idx }) => (
          <div
            key={note}
            className={getKeyClass(note, false)}
            style={{ left: idx * WHITE_W }}
            onMouseDown={() => onNoteInput(note)}
            onTouchStart={e => { e.preventDefault(); onNoteInput(note) }}
          >
            {expectedKey === note && <span className={styles.arrow}>▼</span>}
            <span className={styles.label}>{note}</span>
          </div>
        ))}
        {/* Black keys */}
        {blackKeys.map(({ note, prevIdx }) => (
          <div
            key={note}
            className={getKeyClass(note, true)}
            style={{ left: (prevIdx + 1) * WHITE_W - 12 }}
            onMouseDown={e => { e.stopPropagation(); onNoteInput(note) }}
            onTouchStart={e => { e.preventDefault(); e.stopPropagation(); onNoteInput(note) }}
          />
        ))}
      </div>
    </div>
  )
}
