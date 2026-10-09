import { Star } from 'lucide-react'
import { formatInteger } from '../../../lib/format.ts'
import { careActions, holderSummary, statRows, type CareStatus, type CreatureView } from '../view.ts'
import { CareKeys } from './CareKeys.tsx'
import { CollectionShelf } from './CollectionShelf.tsx'
import { CreatureStage } from './CreatureStage.tsx'
import { StatStrip } from './StatStrip.tsx'
import styles from './CreatureHome.module.css'

export interface CreatureHomeProps {
  primary: CreatureView
  others: CreatureView[]
  care: CareStatus
  celebrateKey?: number
  onCare: (action: string) => void
  onRetryCare?: () => void
  linkTo: (id: string) => string
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}

export const UNKNOWN_PACKAGE_CARE =
  'This creature comes from a package version this client does not describe yet, so its care actions stay off. Its server facts are shown as reported.'

export function CreatureHome(props: CreatureHomeProps) {
  const { primary } = props
  const { creature, presentation } = primary
  const holders = holderSummary(creature)
  return (
    <div className={styles.home}>
      <article className={styles.device} aria-labelledby="creature-name">
        <CreatureStage view={primary} celebrateKey={props.celebrateKey} />
        <div className={styles.plate}>
          <div className={styles.identity}>
            <h1 id="creature-name" className={styles.name}>
              {creature.name}
            </h1>
            <p className={styles.meta}>
              <span className={styles.level}>Level {creature.level}</span>
              <span className="tabular">{formatInteger(creature.xp)} XP</span>
              {creature.role === 'PRIMARY' && (
                <span className={styles.role}>
                  <Star size={14} aria-hidden="true" /> Primary
                </span>
              )}
            </p>
            <p className={styles.origin}>
              {presentation ? presentation.package.name : 'Unknown package version'}
              {holders && <> · {holders}</>}
            </p>
          </div>
          <StatStrip rows={statRows(primary)} />
        </div>
      </article>
      <div className={styles.controls}>
        <CareKeys
          creatureName={creature.name}
          actions={careActions(presentation)}
          status={props.care}
          unavailableReason={presentation ? null : UNKNOWN_PACKAGE_CARE}
          onCare={props.onCare}
          onRetry={props.onRetryCare}
        />
        <CollectionShelf
          items={props.others}
          linkTo={props.linkTo}
          hasMore={props.hasMore}
          loadingMore={props.loadingMore}
          onLoadMore={props.onLoadMore}
        />
      </div>
    </div>
  )
}
