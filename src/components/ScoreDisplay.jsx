import { useEffect, useRef, useCallback } from 'react'
import styles from './ScoreDisplay.module.css'
import {
  renderScore,
  colorNoteEl, dimNoteEl,
  STAFF_H, MARGIN_T,
} from '../utils/scoreRenderer'

export default function ScoreDisplay({
  parsedScore,
  mode,
  activeNotes,       // { noteId: colorString }
  noteXYRef,
  currentNoteRef,
}) {
  const wrapRef      = useRef(null)
  const canvasRef    = useRef(null)
  const rafRef       = useRef(null)
  const prevNotesRef = useRef({})

  // ── Render SVG on score change ───────────────────────────────
  useEffect(() => {
    if (!parsedScore || !wrapRef.current) return
    const W = (wrapRef.current.clientWidth || 900) - 8
    const { svgString, noteXY } = renderScore(parsedScore, W)
    wrapRef.current.innerHTML = svgString
    noteXYRef.current = noteXY
    prevNotesRef.current = {}
    resizeCanvas()
  }, [parsedScore])

  // ── Resize handler ───────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (!parsedScore || !wrapRef.current) return
      const W = (wrapRef.current.clientWidth || 900) - 8
      const { svgString, noteXY } = renderScore(parsedScore, W)
      wrapRef.current.innerHTML = svgString
      noteXYRef.current = noteXY
      resizeCanvas()
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [parsedScore])

  // ── Apply activeNotes colors to SVG elements ─────────────────
  useEffect(() => {
    const prev  = prevNotesRef.current
    const cur   = activeNotes || {}

    // Notes removed from active — reset to black ink
    for (const id of Object.keys(prev)) {
      if (!cur[id]) {
        const el = document.getElementById(id)
        if (el) {
          el.querySelectorAll('ellipse').forEach(e => {
            const wasFilled = e.getAttribute('fill') !== 'none'
            e.setAttribute('fill', wasFilled ? '#1a1410' : 'none')
            e.setAttribute('stroke', '#1a1410')
          })
          el.querySelectorAll('path, line').forEach(e => e.setAttribute('stroke', '#1a1410'))
        }
      }
    }

    // Notes added or changed color
    for (const [id, color] of Object.entries(cur)) {
      if (prev[id] !== color) {
        colorNoteEl(id, color)
      }
    }

    prevNotesRef.current = { ...cur }
  }, [activeNotes])

  // ── Cursor animation ─────────────────────────────────────────
  useEffect(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (!mode || mode === 'idle') { clearCanvas(); return }

    const animate = (ts) => {
      const noteId = currentNoteRef.current
      const xy     = noteId ? noteXYRef.current?.[noteId] : null
      if (!xy) { clearCanvas(); rafRef.current = requestAnimationFrame(animate); return }

      // Scroll note into view
      scrollToNote(xy)

      const alpha = mode === 'practice'
        ? 0.45 + 0.55 * Math.abs(Math.sin(ts / 220))
        : 0.75

      drawCursor(xy, alpha)
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [mode])

  // ── Canvas helpers ────────────────────────────────────────────
  const resizeCanvas = () => {
    const wrap = wrapRef.current?.parentElement
    if (!canvasRef.current || !wrap) return
    canvasRef.current.width  = wrap.clientWidth
    canvasRef.current.height = wrap.clientHeight
  }

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  const drawCursor = (xy, alpha) => {
    const canvas = canvasRef.current
    const svgEl  = document.getElementById('score-svg')
    if (!canvas || !svgEl) return

    const ctx = canvas.getContext('2d')
    const sa  = canvas.parentElement
    const sr  = svgEl.getBoundingClientRect()
    const sar = sa.getBoundingClientRect()
    const scX = sr.width  / parseFloat(svgEl.getAttribute('width'))
    const scY = sr.height / parseFloat(svgEl.getAttribute('height'))

    const cx  = (sr.left - sar.left) + xy.svgX * scX
    const cy1 = (sr.top - sar.top) + sa.scrollTop + (xy.staffTop - 8) * scY
    const cy2 = cy1 + (STAFF_H + 14) * scY

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    ctx.strokeStyle = '#c8a96e'
    ctx.lineWidth   = 2.5
    ctx.globalAlpha = alpha
    ctx.shadowColor = '#c8a96e'
    ctx.shadowBlur  = 18
    ctx.beginPath()
    ctx.moveTo(cx, cy1)
    ctx.lineTo(cx, cy2)
    ctx.stroke()
    ctx.restore()
  }

  const scrollToNote = (xy) => {
    const svgEl = document.getElementById('score-svg')
    const sa    = canvasRef.current?.parentElement
    if (!svgEl || !sa) return
    const sr   = svgEl.getBoundingClientRect()
    const sar  = sa.getBoundingClientRect()
    const scY  = sr.height / parseFloat(svgEl.getAttribute('height'))
    const absT = sr.top + xy.staffTop * scY
    const absB = absT + STAFF_H * scY
    if (absT < sar.top + 80)        sa.scrollTop -= 120
    else if (absB > sar.bottom - 80) sa.scrollTop += 120
  }

  return (
    <div className={styles.scoreArea}>
      <div className={styles.svgWrap} ref={wrapRef} />
      <canvas className={styles.canvas} ref={canvasRef} aria-hidden="true" />
    </div>
  )
}
