import { RelationshipBadge } from '../../components/RelationshipBadge.tsx'
import { formatRelative } from '../../lib/time.ts'
import { useProfile } from '../players/api.ts'
import type { Marker } from './dto.ts'
import { formatDistance } from './geo.ts'
import styles from './Explore.module.css'

function Row({ marker, now, selected, onSelect }: { marker: Marker; now: number; selected: boolean; onSelect: () => void }) {
  const profile = useProfile(marker.user_id)
  return (
    <li>
      <button type="button" className={styles.row} aria-pressed={selected} onClick={onSelect}>
        <span className={styles.rowName}>{profile.data?.username ?? 'Player'}</span>
        <RelationshipBadge kind={marker.relationship} />
        <span className={styles.rowMeta}>
          {formatDistance(marker.distance_m)} · {formatRelative(marker.timestamp, now)}
        </span>
      </button>
    </li>
  )
}

/** Usable without WebGL or map tiles: the same returned players, in server order. */
export function NearbyList({ markers, now, selectedId, onSelect }: { markers: Marker[]; now: number; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <ul className={styles.list} aria-label="Nearby players">
      {markers.map((marker) => (
        <Row key={marker.user_id} marker={marker} now={now} selected={marker.user_id === selectedId} onSelect={() => onSelect(marker.user_id)} />
      ))}
    </ul>
  )
}
