import styles from './ResultsModal.module.css'

export default function ResultsModal({ stats, onClose }) {
  if (!stats) return null
  const { correct, wrong, missed, accuracy, score } = stats

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.box}>
        <div className={styles.title}>SESSION COMPLETE</div>
        <div className={styles.scoreWrap}>
          <div className={styles.bigScore}>{score}</div>
          <div className={styles.bigLbl}>SCORE</div>
        </div>
        <div className={styles.grid}>
          <div className={styles.cell}>
            <div className={`${styles.val} ${styles.green}`}>{correct}</div>
            <div className={styles.lbl}>CORRECT</div>
          </div>
          <div className={styles.cell}>
            <div className={`${styles.val} ${styles.red}`}>{wrong}</div>
            <div className={styles.lbl}>WRONG</div>
          </div>
          <div className={styles.cell}>
            <div className={`${styles.val} ${styles.orange}`}>{missed}</div>
            <div className={styles.lbl}>SKIPPED</div>
          </div>
          <div className={styles.cell}>
            <div className={`${styles.val} ${styles.blue}`}>{accuracy}</div>
            <div className={styles.lbl}>ACCURACY</div>
          </div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>CLOSE</button>
      </div>
    </div>
  )
}
