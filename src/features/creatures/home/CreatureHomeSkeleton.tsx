import { CreatureStageSkeleton } from './CreatureStage.tsx'
import styles from './CreatureHome.module.css'

export function CreatureHomeSkeleton() {
  return (
    <main className={styles.home} aria-busy="true" aria-label="Loading your creatures">
      <div className={styles.device}>
        <CreatureStageSkeleton />
        <div className={styles.plate}>
          <div className={styles.skeletonLine} style={{ width: '55%', height: 28 }} />
          <div className={styles.skeletonLine} style={{ width: '35%' }} />
          <div className={styles.skeletonLine} style={{ width: '80%', height: 40 }} />
        </div>
      </div>
      <p className="visually-hidden" role="status">
        Loading your creatures…
      </p>
    </main>
  )
}
