import { Link } from 'react-router'
import { CreatureArt } from '../../../components/CreatureArt.tsx'
import { TypeGlyph } from '../../../components/TypeBadge.tsx'
import { typeLabel } from '../../../components/typeLabel.ts'
import type { CreatureView } from '../view.ts'
import styles from './CollectionShelf.module.css'

interface CollectionShelfProps {
  items: CreatureView[]
  linkTo: (id: string) => string
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}

export function CollectionShelf({ items, linkTo, hasMore = false, loadingMore = false, onLoadMore }: CollectionShelfProps) {
  return (
    <section className={styles.shelf} aria-labelledby="collection-heading">
      <div className={styles.header}>
        <h2 id="collection-heading">Other creatures</h2>
        {items.length > 0 && <span className={styles.count}>{items.length}{hasMore ? '+' : ''}</span>}
      </div>
      {items.length === 0 ? (
        <p className={styles.empty}>
          No other creatures yet. Joining another package adds its starter here, and shared creatures from battles appear
          too.
        </p>
      ) : (
        <ul className={styles.list}>
          {items.map(({ creature, artUrl }) => (
            <li key={creature.id}>
              <Link to={linkTo(creature.id)} className={styles.tile}>
                <span className={styles.portrait} data-type={creature.combat_type}>
                  <CreatureArt src={artUrl} alt="" size={80} />
                </span>
                <span className={styles.name}>{creature.name}</span>
                <span className={styles.meta}>
                  <TypeGlyph type={creature.combat_type} size={16} />
                  <span>
                    Level {creature.level} · {typeLabel(creature.combat_type)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hasMore && onLoadMore && (
        <button type="button" className={styles.more} onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load more creatures'}
        </button>
      )}
    </section>
  )
}
