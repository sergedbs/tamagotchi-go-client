import { Link } from 'react-router'
import { X } from 'lucide-react'
import { RelationshipBadge } from '../../components/RelationshipBadge.tsx'
import { formatAbsolute, formatRelative } from '../../lib/time.ts'
import { useProfile } from '../players/api.ts'
import type { Marker } from './dto.ts'
import { formatDistance } from './geo.ts'
import styles from './Explore.module.css'

export function PlayerSheet({ marker, now, onClose }: { marker: Marker; now: number; onClose: () => void }) {
  const profile = useProfile(marker.user_id)
  return (
    <section className={styles.sheet} aria-labelledby="player-sheet-title">
      <div className={styles.sheetHeader}>
        <h2 id="player-sheet-title">{profile.data?.username ?? (profile.isError ? 'Player' : 'Loading…')}</h2>
        <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close player details">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <p className={styles.sheetMeta}>
        <RelationshipBadge kind={marker.relationship} />
        <span>{formatDistance(marker.distance_m)} away</span>
        <span title={formatAbsolute(marker.timestamp)}>seen {formatRelative(marker.timestamp, now)}</span>
      </p>
      {marker.accuracy_m != null && <p className={styles.muted}>Their position is accurate to about {formatDistance(marker.accuracy_m)}.</p>}
      <Link to={`/players/${marker.user_id}`} className={styles.sheetLink}>
        View profile
      </Link>
    </section>
  )
}
