import { Heart, Swords, User } from 'lucide-react'
import styles from './RelationshipBadge.module.css'

export type RelationshipKind = 'friend' | 'enemy' | 'stranger'

const LABEL: Record<RelationshipKind, string> = { friend: 'Friend', enemy: 'Enemy', stranger: 'Stranger' }
const ICON = { friend: Heart, enemy: Swords, stranger: User }

/** Relationship as icon plus text; colour is never the only signal. */
export function RelationshipBadge({ kind }: { kind: RelationshipKind }) {
  const Icon = ICON[kind]
  return (
    <span className={styles.badge} data-relationship={kind}>
      <Icon size={14} aria-hidden="true" strokeWidth={2.5} />
      {LABEL[kind]}
    </span>
  )
}
