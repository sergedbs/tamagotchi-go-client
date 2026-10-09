import { CreatureArt } from '../../../components/CreatureArt.tsx'
import { Habitat } from '../../../components/Habitat.tsx'
import { TypeBadge } from '../../../components/TypeBadge.tsx'
import type { CreatureView } from '../view.ts'
import styles from './CreatureStage.module.css'

interface CreatureStageProps {
  view: CreatureView
  /** Increments after each confirmed care action to play a short hop. */
  celebrateKey?: number
}

export function CreatureStage({ view, celebrateKey = 0 }: CreatureStageProps) {
  const { creature } = view
  return (
    <div className={styles.stage}>
      <Habitat type={creature.combat_type} />
      <div className={styles.hud}>
        <TypeBadge type={creature.combat_type} />
      </div>
      <div className={styles.figure}>
        <div key={celebrateKey} className={celebrateKey > 0 ? `${styles.body} ${styles.hop}` : styles.body}>
          <div className={styles.idle}>
            <CreatureArt src={view.artUrl} alt={creature.name} eager />
          </div>
        </div>
        <div className={styles.shadow} aria-hidden="true" />
      </div>
    </div>
  )
}

export function CreatureStageSkeleton() {
  return (
    <div className={`${styles.stage} ${styles.skeleton}`} aria-hidden="true">
      <Habitat type={null} />
      <div className={styles.figure}>
        <div className={styles.placeholder} />
        <div className={styles.shadow} />
      </div>
    </div>
  )
}
