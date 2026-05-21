import styles from './WelcomeScreen.module.css'

const SAMPLES = [
  { key: 'twinkle',   label: 'Twinkle Twinkle',   composer: 'Traditional' },
  { key: 'ode',       label: 'Ode to Joy',         composer: 'Beethoven' },
  { key: 'canon',     label: 'Canon in D',          composer: 'Pachelbel' },
  { key: 'moonlight', label: 'Moonlight Sonata',   composer: 'Beethoven' },
]

export default function WelcomeScreen({ onLoadSample, onFileLoad }) {
  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const r = new FileReader()
    r.onload = ev => onFileLoad(ev.target.result, f.name)
    r.readAsText(f)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (!f) return
    const r = new FileReader()
    r.onload = ev => onFileLoad(ev.target.result, f.name)
    r.readAsText(f)
  }

  return (
    <div
      className={styles.wrap}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className={styles.inner}>
        <div className={styles.clef}>𝄞</div>
        <h1 className={styles.title}>Verny Piano</h1>
        <p className={styles.sub}>Piano Practice · Sheet Music · MusicXML</p>

        <label className={styles.dropZone}>
          <input type="file" accept=".xml,.musicxml,.mxl" onChange={handleFile} hidden />
          <span className={styles.dropIcon}>📂</span>
          <span className={styles.dropText}>Drop a MusicXML file or click to browse</span>
        </label>

        <div className={styles.divider}>
          <span>or choose a sample</span>
        </div>

        <div className={styles.samples}>
          {SAMPLES.map(({ key, label, composer }) => (
            <button
              key={key}
              className={styles.sampleBtn}
              onClick={() => onLoadSample(key)}
            >
              <span className={styles.sampleLabel}>{label}</span>
              <span className={styles.sampleComposer}>{composer}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
