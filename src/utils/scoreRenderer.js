/**
 * Score Renderer
 * Renders a parsed MusicXML score as SVG strings.
 * Supports treble + bass clef grand staff layout.
 */

// Layout constants
export const STAFF_SEP    = 10    // px between staff lines
export const STAFF_H      = 40    // 4 gaps × 10
export const GRAND_GAP    = 36    // gap between treble and bass staves
export const GRAND_H      = STAFF_H * 2 + GRAND_GAP  // full grand staff height
export const MARGIN_L     = 60
export const MARGIN_T     = 80
export const ROW_H        = GRAND_H + 60   // vertical space per grand staff row
export const MPR          = 3              // measures per row
export const LEDGER_W     = 14

// Staff position helpers
// Treble clef: top line = E5 (sp=0), each step down = +1
// Bass clef:   top line = G3 (sp=0), each step down = +1

const STEPS = ['C','D','E','F','G','A','B']

function trebleStaffPos(step, oct) {
  const e5 = 5 * 7 + 4  // E5 diatonic index from C0
  return e5 - (oct * 7 + STEPS.indexOf(step))
}

function bassStaffPos(step, oct) {
  const g3 = 3 * 7 + 4  // G3 diatonic index from C0
  return g3 - (oct * 7 + STEPS.indexOf(step))
}

function nhY(staffTop, sp) {
  return staffTop + sp * (STAFF_SEP / 2)
}

function isFilled(type) { return !['whole','half'].includes(type) }
function hasStem(type)  { return type !== 'whole' }
function numFlags(type) { return { '64th':4,'32nd':3,'16th':2,'eighth':1 }[type] || 0 }

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
}

/**
 * Main render function.
 * Returns { svgString, noteXY } where noteXY maps note id -> { svgX, staffTop, clef }
 */
export function renderScore(parsed, W) {
  const noteXY = {}
  const { title, composerName, keyFifths, beatsPerMeasure, beatType, parts } = parsed

  const treblePart = parts[0]
  const bassPart   = parts[1] || null

  const measureCount = treblePart?.measures.length || 0
  if (!measureCount) return { svgString: '<svg></svg>', noteXY }

  const numRows = Math.ceil(measureCount / MPR)
  const H       = MARGIN_T + numRows * ROW_H + 60
  const rowW    = W - MARGIN_L * 2

  let s = `<svg id="score-svg" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
  s += `<rect width="${W}" height="${H}" fill="#f4efe6"/>`

  // Title
  s += `<text x="${W/2}" y="32" text-anchor="middle" font-size="22" font-family="Playfair Display,serif" font-weight="700" fill="#1a1410">${esc(title)}</text>`
  if (composerName) {
    s += `<text x="${W-30}" y="54" text-anchor="end" font-size="13" font-family="Libre Baskerville,serif" font-style="italic" fill="#5a4a38">${esc(composerName)}</text>`
  }

  for (let row = 0; row < numRows; row++) {
    const rowStart   = row * MPR
    const rowMs      = treblePart.measures.slice(rowStart, rowStart + MPR)
    const rowBassMs  = bassPart ? bassPart.measures.slice(rowStart, rowStart + MPR) : []
    const tStaffTop  = MARGIN_T + row * ROW_H
    const bStaffTop  = tStaffTop + STAFF_H + GRAND_GAP
    const mW         = rowW / rowMs.length

    // Draw brace on left
    s += drawBrace(MARGIN_L - 18, tStaffTop, bStaffTop + STAFF_H)

    // Draw both staves for the full row width
    s += drawStaffLines(MARGIN_L, tStaffTop, rowW, '#1a1410')
    s += drawStaffLines(MARGIN_L, bStaffTop, rowW, '#1a1410')

    // System barline connecting both staves
    s += `<line x1="${MARGIN_L}" y1="${tStaffTop}" x2="${MARGIN_L}" y2="${bStaffTop + STAFF_H}" stroke="#1a1410" stroke-width="1.5"/>`

    let rx = MARGIN_L

    // Treble clef
    s += `<text x="${rx+2}" y="${tStaffTop + STAFF_H - 2}" font-size="60" font-family="serif" fill="#1a1410">𝄞</text>`
    // Bass clef
    s += `<text x="${rx+4}" y="${bStaffTop + 22}" font-size="36" font-family="serif" fill="#1a1410">𝄢</text>`
    rx += 34

    // Key signature (treble + bass)
    if (keyFifths !== 0) {
      const kw = drawKeySig(s, keyFifths, rx, tStaffTop, bStaffTop)
      // re-accumulate inline
      const [ksvg, kwi] = keySigSVG(keyFifths, rx, tStaffTop, bStaffTop)
      s += ksvg
      rx += kwi
    }

    // Time signature
    s += timeSigSVG(beatsPerMeasure, beatType, rx, tStaffTop)
    s += timeSigSVG(beatsPerMeasure, beatType, rx, bStaffTop)
    rx += 22

    // Opening barline
    s += `<line x1="${rx}" y1="${tStaffTop}" x2="${rx}" y2="${bStaffTop + STAFF_H}" stroke="#1a1410" stroke-width="1.5"/>`

    // Render measures
    for (let mi = 0; mi < rowMs.length; mi++) {
      const mIdx   = rowStart + mi
      const meas   = rowMs[mi]
      const bMeas  = rowBassMs[mi] || null
      const mLeft  = rx
      const mRight = rx + mW
      const na     = mRight - mLeft - 12

      // Measure number
      s += `<text x="${mLeft+3}" y="${tStaffTop - 5}" font-size="8" fill="#9a8878" font-family="JetBrains Mono,monospace">${meas.number}</text>`

      // Treble notes
      for (let ni = 0; ni < meas.notes.length; ni++) {
        const note = meas.notes[ni]
        if (note.isChord) continue
        const chord = [note]
        for (let k = ni+1; k < meas.notes.length; k++) {
          if (meas.notes[k].isChord && Math.abs(meas.notes[k].startBeat - note.startBeat) < 0.01) chord.push(meas.notes[k])
          else break
        }
        const nx  = mLeft + 10 + (note.startBeat / meas.beats) * na
        const nid = `n_${mIdx}_${ni}`
        if (note.isRest) { s += drawRest(note.type, nx, tStaffTop, note.dots, nid) }
        else {
          s += drawChordNotes(chord, nx, tStaffTop, note.type, note.dots, nid, 'treble')
          if (chord[0].step) noteXY[nid] = { svgX: nx, staffTop: tStaffTop, clef: 'treble' }
        }
      }

      // Bass notes
      if (bMeas) {
        for (let ni = 0; ni < bMeas.notes.length; ni++) {
          const note = bMeas.notes[ni]
          if (note.isChord) continue
          const chord = [note]
          for (let k = ni+1; k < bMeas.notes.length; k++) {
            if (bMeas.notes[k].isChord && Math.abs(bMeas.notes[k].startBeat - note.startBeat) < 0.01) chord.push(bMeas.notes[k])
            else break
          }
          const nx  = mLeft + 10 + (note.startBeat / bMeas.beats) * na
          const nid = `bn_${mIdx}_${ni}`
          if (note.isRest) { s += drawRest(note.type, nx, bStaffTop, note.dots, nid) }
          else {
            s += drawChordNotes(chord, nx, bStaffTop, note.type, note.dots, nid, 'bass')
            if (chord[0].step) noteXY[nid] = { svgX: nx, staffTop: bStaffTop, clef: 'bass' }
          }
        }
      }

      // Barline connecting both staves
      s += `<line x1="${mRight}" y1="${tStaffTop}" x2="${mRight}" y2="${bStaffTop + STAFF_H}" stroke="#1a1410" stroke-width="${mi === rowMs.length-1 ? 2 : 1}"/>`
      rx = mRight
    }
  }

  s += '</svg>'
  return { svgString: s, noteXY }
}

function drawBrace(x, topY, bottomY) {
  const h = bottomY - topY
  const cy1 = topY + h * 0.25
  const cy2 = topY + h * 0.75
  const midY = topY + h * 0.5
  return `<path d="M${x+10},${topY} C${x-10},${cy1} ${x-10},${midY-4} ${x+4},${midY} C${x-10},${midY+4} ${x-10},${cy2} ${x+10},${bottomY}" fill="none" stroke="#1a1410" stroke-width="3"/>`
}

function drawStaffLines(x, staffTop, width, color) {
  let s = ''
  for (let i = 0; i < 5; i++) {
    const y = staffTop + i * STAFF_SEP
    s += `<line x1="${x}" y1="${y}" x2="${x+width}" y2="${y}" stroke="${color}" stroke-width="1.1"/>`
  }
  return s
}

function keySigSVG(fifths, x, tStaffTop, bStaffTop) {
  const sharp = fifths > 0
  const cnt   = Math.abs(fifths)
  // Treble clef sharp positions: F5 C5 G5 D5 A4 E5 B4
  const tSharp = [['F',5],['C',5],['G',5],['D',5],['A',4],['E',5],['B',4]]
  const tFlat  = [['B',4],['E',5],['A',4],['D',5],['G',4],['C',5],['F',4]]
  // Bass clef sharp positions: F3 C3 G3 D3 A2 E3 B2
  const bSharp = [['F',3],['C',3],['G',3],['D',3],['A',2],['E',3],['B',2]]
  const bFlat  = [['B',2],['E',3],['A',2],['D',3],['G',2],['C',3],['F',2]]

  let svg = '', w = 0
  const tList = sharp ? tSharp : tFlat
  const bList = sharp ? bSharp : bFlat
  const sym   = sharp ? '♯' : '♭'

  for (let i = 0; i < cnt; i++) {
    const [ts, to] = tList[i]
    const [bs, bo] = bList[i]
    const ty = nhY(tStaffTop, trebleStaffPos(ts, to))
    const by = nhY(bStaffTop, bassStaffPos(bs, bo))
    svg += `<text x="${x+i*10}" y="${ty+4}" font-size="13" fill="#1a1410" font-family="serif">${sym}</text>`
    svg += `<text x="${x+i*10}" y="${by+4}" font-size="13" fill="#1a1410" font-family="serif">${sym}</text>`
    w = (i+1)*10+6
  }
  return [svg, w || 0]
}

function drawKeySig(s, fifths, x, tStaffTop, bStaffTop) {
  // unused — implemented inline via keySigSVG
}

function timeSigSVG(beats, beatType, x, staffTop) {
  return `<text x="${x+2}" y="${staffTop+14}" font-size="16" fill="#1a1410" font-family="serif" font-weight="bold">${beats}</text>`
       + `<text x="${x+2}" y="${staffTop+STAFF_H}" font-size="16" fill="#1a1410" font-family="serif" font-weight="bold">${beatType}</text>`
}

function drawRest(type, x, st, dots, id) {
  const syms = { whole:'𝄻', half:'𝄼', quarter:'𝄽', eighth:'𝄾', '16th':'𝄿', '32nd':'𝅀' }
  let o = `<g id="${id}">`
  o += `<text x="${x}" y="${st+STAFF_H/2+5}" font-size="15" fill="#1a1410" font-family="serif">${syms[type]||'𝄽'}</text>`
  if (dots) o += `<circle cx="${x+14}" cy="${st+STAFF_H/2-2}" r="1.8" fill="#1a1410"/>`
  return o + '</g>'
}

function drawChordNotes(notes, x, st, type, dots, id, clef) {
  let o = `<g id="${id}" class="score-note">`
  const fill  = isFilled(type)
  const stem  = hasStem(type)
  const flags = numFlags(type)
  const NW = 7, NH = 5.5

  const posFn = clef === 'treble' ? trebleStaffPos : bassStaffPos
  const sps   = notes.filter(n => n.step).map(n => posFn(n.step, n.octave))
  if (!sps.length) return o + '</g>'

  const avgSP  = sps.reduce((a, b) => a + b, 0) / sps.length
  const stemUp = avgSP > 4

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]
    if (!note.step) continue
    const sp = sps[i]
    const ny = nhY(st, sp)

    // Ledger lines above staff
    for (let ls = -2; ls >= sp; ls -= 2) {
      const ly = nhY(st, ls)
      o += `<line x1="${x-LEDGER_W/2}" y1="${ly}" x2="${x+NW+LEDGER_W/2}" y2="${ly}" stroke="#1a1410" stroke-width="1"/>`
    }
    // Ledger lines below staff
    for (let ls = 10; ls <= sp; ls += 2) {
      const ly = nhY(st, ls)
      o += `<line x1="${x-LEDGER_W/2}" y1="${ly}" x2="${x+NW+LEDGER_W/2}" y2="${ly}" stroke="#1a1410" stroke-width="1"/>`
    }

    // Accidental
    if (note.accidental || note.alter) {
      const sym = (note.accidental==='sharp'||note.alter>0) ? '♯'
                : (note.accidental==='flat'||note.alter<0)  ? '♭'
                :  note.accidental==='natural'              ? '♮' : ''
      if (sym) o += `<text x="${x-10}" y="${ny+4}" font-size="11" fill="#1a1410" font-family="serif">${sym}</text>`
    }

    // Notehead
    if (fill) {
      o += `<ellipse cx="${x+NW/2}" cy="${ny}" rx="${NW/2}" ry="${NH/2}" fill="#1a1410"/>`
    } else {
      o += `<ellipse cx="${x+NW/2}" cy="${ny}" rx="${NW/2}" ry="${NH/2}" fill="none" stroke="#1a1410" stroke-width="${type==='whole'?1.8:1.2}"/>`
    }
    if (dots) o += `<circle cx="${x+NW+4}" cy="${ny-1}" r="1.7" fill="#1a1410"/>`
  }

  // Stem
  if (stem && sps.length) {
    const sx     = stemUp ? x + NW - 1 : x + 1
    const baseSP = stemUp ? Math.max(...sps) : Math.min(...sps)
    const baseY  = nhY(st, baseSP)
    const endY   = stemUp ? baseY - 30 : baseY + 30
    o += `<line x1="${sx}" y1="${baseY}" x2="${sx}" y2="${endY}" stroke="#1a1410" stroke-width="1.2"/>`

    for (let f = 0; f < flags; f++) {
      const fy = stemUp ? endY + f*7 : endY - f*7
      if (stemUp) {
        o += `<path d="M${sx},${fy} C${sx+13},${fy+7} ${sx+13},${fy+14} ${sx},${fy+18}" fill="none" stroke="#1a1410" stroke-width="1.2"/>`
      } else {
        o += `<path d="M${sx},${fy} C${sx+13},${fy-7} ${sx+13},${fy-14} ${sx},${fy-18}" fill="none" stroke="#1a1410" stroke-width="1.2"/>`
      }
    }
  }

  return o + '</g>'
}

// Color a note element in the SVG
export function colorNoteEl(id, color) {
  const el = document.getElementById(id)
  if (!el) return
  el.querySelectorAll('ellipse').forEach(e => { e.setAttribute('fill', color); e.setAttribute('stroke', color) })
  el.querySelectorAll('path').forEach(e => e.setAttribute('stroke', color))
  el.querySelectorAll('line').forEach(e => e.setAttribute('stroke', color))
}

export function resetNoteEl(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.querySelectorAll('ellipse').forEach(e => {
    const wasFill = e.getAttribute('fill') !== 'none'
    e.setAttribute('fill', wasFill ? '#1a1410' : 'none')
    e.setAttribute('stroke', '#1a1410')
  })
  el.querySelectorAll('path, line').forEach(e => e.setAttribute('stroke', '#1a1410'))
}

export function dimNoteEl(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.querySelectorAll('ellipse').forEach(e => { e.setAttribute('fill', '#c8bfaf'); e.setAttribute('stroke', '#c8bfaf') })
  el.querySelectorAll('path, line').forEach(e => e.setAttribute('stroke', '#c8bfaf'))
}
