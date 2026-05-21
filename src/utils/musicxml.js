/**
 * MusicXML Parser
 * Parses a MusicXML string into a structured score object.
 * Supports treble and bass clef, key/time signatures, chords, rests, dots.
 */

const FIFTHS_KEY = {
  '-7':'Cb','-6':'Gb','-5':'Db','-4':'Ab','-3':'Eb','-2':'Bb','-1':'F',
  '0':'C','1':'G','2':'D','3':'A','4':'E','5':'B','6':'F#','7':'C#'
}

const FLAT_TO_SHARP = { Db:'C#', Eb:'D#', Gb:'F#', Ab:'G#', Bb:'A#' }

export function parseMusicXML(xmlStr) {
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Invalid XML — check the file format.')

  const titleEl      = doc.querySelector('movement-title, work-title')
  const title        = titleEl ? titleEl.textContent.trim() : 'Untitled'
  const compEl       = doc.querySelector('creator[type="composer"]')
  const composerName = compEl ? compEl.textContent.trim() : ''

  // Gather parts (treble = first, bass = second if present)
  const partEls = Array.from(doc.querySelectorAll('part'))

  const allParts = partEls.map((partEl, partIdx) => parsePart(partEl, partIdx))

  // Detect global time/key from first part
  const firstMeasure = allParts[0]?.measures[0]
  const beatsPerMeasure = firstMeasure?.beats || 4
  const beatType        = firstMeasure?.beatType || 4
  const keyFifths       = firstMeasure?.keyFifths ?? 0
  const tempoFromScore  = allParts[0]?.tempoFromScore || null

  return {
    title,
    composerName,
    keyFifths,
    keyName: FIFTHS_KEY[String(keyFifths)] || 'C',
    beatsPerMeasure,
    beatType,
    tempoFromScore,
    parts: allParts,
    measureCount: allParts[0]?.measures.length || 0,
  }
}

function parsePart(partEl, partIdx) {
  let divisions       = 4
  let beatsPerMeasure = 4
  let beatType        = 4
  let keyFifths       = 0
  let tempoFromScore  = null
  let clefSign        = partIdx === 0 ? 'G' : 'F'  // default treble/bass

  const measures   = []
  let   globalBeat = 0

  for (const mEl of partEl.querySelectorAll('measure')) {
    const dv  = mEl.querySelector('divisions');           if (dv)  divisions       = parseInt(dv.textContent, 10)
    const bts = mEl.querySelector('time > beats');        if (bts) beatsPerMeasure = parseInt(bts.textContent, 10)
    const bt  = mEl.querySelector('time > beat-type');   if (bt)  beatType        = parseInt(bt.textContent, 10)
    const fif = mEl.querySelector('key > fifths');        if (fif) keyFifths       = parseInt(fif.textContent, 10)
    const snd = mEl.querySelector('sound[tempo]');        if (snd) tempoFromScore  = parseFloat(snd.getAttribute('tempo'))
    const clf = mEl.querySelector('clef > sign');         if (clf) clefSign        = clf.textContent

    const measure = {
      number:    parseInt(mEl.getAttribute('number'), 10) || measures.length + 1,
      beats:     beatsPerMeasure,
      beatType,
      keyFifths,
      clefSign,
      startBeat: globalBeat,
      notes:     [],
    }

    let inBeat = 0

    for (const nEl of mEl.querySelectorAll('note')) {
      const isRest  = !!nEl.querySelector('rest')
      const isChord = !!nEl.querySelector('chord')
      const dur     = parseInt(nEl.querySelector('duration')?.textContent || '0', 10)
      const type    = nEl.querySelector('type')?.textContent || 'quarter'
      const dots    = nEl.querySelectorAll('dot').length

      if (isChord) inBeat -= dur / divisions
      const startBeat = inBeat
      const durBeats  = dur / divisions

      const noteObj = {
        isRest, isChord, type, dots,
        startBeat, duration: durBeats,
        step: null, octave: null, alter: 0,
        noteName: null, accidental: null,
      }

      if (!isRest) {
        const stepEl  = nEl.querySelector('step')
        const octEl   = nEl.querySelector('octave')
        const alterEl = nEl.querySelector('alter')
        const accEl   = nEl.querySelector('accidental')

        if (stepEl && octEl) {
          const step  = stepEl.textContent
          const oct   = parseInt(octEl.textContent, 10)
          const alter = alterEl ? Math.round(parseFloat(alterEl.textContent)) : 0

          noteObj.step       = step
          noteObj.octave     = oct
          noteObj.alter      = alter
          noteObj.accidental = accEl ? accEl.textContent : null

          let nn = step + (alter === 1 ? '#' : alter === -1 ? 'b' : '') + oct
          const base = nn.replace(/\d+/, '')
          const octN = nn.match(/\d+/)[0]
          if (FLAT_TO_SHARP[base]) nn = FLAT_TO_SHARP[base] + octN
          noteObj.noteName = nn
        }
      }

      measure.notes.push(noteObj)
      if (!isChord) inBeat += durBeats
    }

    measures.push(measure)
    globalBeat += beatsPerMeasure
  }

  return { clefSign, measures, tempoFromScore }
}

// Build a flat ordered timeline of playable notes from all parts
export function buildPlaybackTimeline(parsedScore, bpm) {
  const spb = 60 / bpm
  const timeline = []

  for (const part of parsedScore.parts) {
    let msb = 0
    for (let mi = 0; mi < part.measures.length; mi++) {
      const meas = part.measures[mi]
      for (let ni = 0; ni < meas.notes.length; ni++) {
        const note = meas.notes[ni]
        if (note.isRest || note.isChord || !note.noteName) continue
        timeline.push({
          id:      `n_${mi}_${ni}`,
          note:    note.noteName,
          startMs: (msb + note.startBeat) * spb * 1000,
          durMs:   note.duration * spb * 1000,
        })
      }
      msb += meas.beats
    }
  }

  timeline.sort((a, b) => a.startMs - b.startMs)
  return timeline
}

// Build practice queue from first part (melody)
export function buildPracticeQueue(parsedScore) {
  const queue = []
  const part  = parsedScore.parts[0]
  if (!part) return queue

  for (let mi = 0; mi < part.measures.length; mi++) {
    const meas = part.measures[mi]
    for (let ni = 0; ni < meas.notes.length; ni++) {
      const note = meas.notes[ni]
      if (note.isRest || note.isChord || !note.noteName) continue
      queue.push({ id: `n_${mi}_${ni}`, note: note.noteName })
    }
  }
  return queue
}
