import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { RelationshipBadge, type RelationshipKind } from '../../components/RelationshipBadge.tsx'
import { useProfile } from '../players/api.ts'
import styles from './Social.module.css'

export function PersonName({ userId }: { userId: string }) {
  const profile = useProfile(userId)
  return <>{profile.data?.username ?? (profile.isError ? 'Unknown player' : 'Loading…')}</>
}

export function PersonRow({ userId, relationship, meta, children }: { userId: string; relationship?: RelationshipKind; meta?: ReactNode; children?: ReactNode }) {
  return (
    <li className={styles.person}>
      <div className={styles.personMain}>
        <Link to={`/players/${userId}`} className={styles.personName}>
          <PersonName userId={userId} />
        </Link>
        {relationship && <RelationshipBadge kind={relationship} />}
        {meta && <span className={styles.muted}>{meta}</span>}
      </div>
      {children && <div className={styles.personActions}>{children}</div>}
    </li>
  )
}
