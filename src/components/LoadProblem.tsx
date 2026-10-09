import { CloudOff, RotateCcw } from 'lucide-react'
import { CorrelationRef } from './CorrelationRef.tsx'
import styles from './LoadProblem.module.css'

interface LoadProblemProps {
  title: string
  message: string
  correlationId?: string | null
  onRetry?: () => void
  retrying?: boolean
}

/** A read failed: say what is unavailable, keep a retry and the reference. */
export function LoadProblem({ title, message, correlationId, onRetry, retrying = false }: LoadProblemProps) {
  return (
    <section className={styles.problem} role="alert">
      <CloudOff className={styles.icon} size={28} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{message}</p>
      <div className={styles.actions}>
        {onRetry && (
          <button type="button" className={styles.retry} onClick={onRetry} disabled={retrying}>
            <RotateCcw size={18} aria-hidden="true" /> {retrying ? 'Trying again…' : 'Try again'}
          </button>
        )}
        {correlationId && <CorrelationRef id={correlationId} />}
      </div>
    </section>
  )
}
