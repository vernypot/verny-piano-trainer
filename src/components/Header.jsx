import styles from './Header.module.css'

const MODE_CONFIG = {
  idle:     { label: 'IDLE',     cls: '' },
  demo:     { label: 'DEMO',     cls: styles.demo },
  practice: { label: 'PRACTICE', cls: styles.practice },
}

export default function Header({
  fileName, mode, bpm, stats, audioStatus,
  onLoadFile, onDemo, onPractice, onStop, onBpmChange,
}) {
  const handleFile = (e) => {
    const f = e.target.files[0]; if (!f) return
    const r = new FileReader()
    r.onload = ev => onLoadFile(ev.target.result, f.name)
    r.readAsText(f)
  }

  const { label: modeLabel, cls: modeCls } = MODE_CONFIG[mode] || MODE_CONFIG.idle

  return (
    <header className={styles.header}>
      <div className={styles.logo}>VERNY</div>

      <label className={styles.fileBtn} title="Load MusicXML file">
        <span className={styles.fileIcon}>𝄞</span>
        <span className={styles.fileName}>{fileName || 'Load Score'}</span>
        <input type="file" accept=".xml,.musicxml,.mxl" onChange={handleFile} hidden />
      </label>

      <div className={`${styles.badge} ${modeCls}`}>{modeLabel}</div>

      {audioStatus && <div className={styles.audioStatus}>{audioStatus}</div>}

      <div className={styles.controls}>
        <div className={styles.bpm}>
          <span>BPM</span>
          <input
            type="range" min="30" max="200" value={bpm}
            onChange={e => onBpmChange(parseInt(e.target.value, 10))}
          />
          <span className={styles.bpmVal}>{bpm}</span>
        </div>
        <button
          className={`${styles.btn} ${styles.btnOrange} ${mode === 'demo' ? styles.active : ''}`}
          onClick={onDemo}
        >▶ DEMO</button>
        <button
          className={`${styles.btn} ${styles.btnGold} ${mode === 'practice' ? styles.active : ''}`}
          onClick={onPractice}
        >🎹 PRACTICE</button>
        <button className={`${styles.btn} ${styles.btnRed}`} onClick={onStop}>■ STOP</button>
      </div>

      {stats && (
        <div className={styles.statsRow}>
          <span className={styles.statG}>{stats.correct}✓</span>
          <span className={styles.statR}>{stats.wrong}✗</span>
          <span className={styles.statO}>{stats.missed}→</span>
          <span className={styles.statB}>{stats.accuracy}</span>
          <span className={styles.statW}>{stats.progress}</span>
        </div>
      )}
    </header>
  )
}
