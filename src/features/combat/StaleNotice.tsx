import { RefreshCw } from 'lucide-react'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { Button } from '../../components/Button.tsx'
import { CorrelationRef } from '../../components/CorrelationRef.tsx'
import styles from './Combat.module.css'

/** The last server state stays visible; live updates retry on the next poll. */
export function StaleNotice({ error, refreshing, onRefresh }: { error: Error; refreshing: boolean; onRefresh: () => void }) {
  return (
    <div className={styles.stale} role="status">
      <p>
        <strong>Live updates paused.</strong> {describeApiError(error)} Showing the last state from the server.
      </p>
      <div className={styles.staleActions}>
        <Button variant="quiet" icon={<RefreshCw size={16} aria-hidden="true" />} busy={refreshing} onClick={onRefresh}>
          Refresh now
        </Button>
        {isApiError(error) && error.correlationId && <CorrelationRef id={error.correlationId} />}
      </div>
    </div>
  )
}
