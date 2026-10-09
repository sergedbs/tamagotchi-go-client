import { Apple, Brush, Compass, Droplets, Heart, LoaderCircle, Moon, RotateCcw, Sparkles, type LucideIcon } from 'lucide-react'
import { CorrelationRef } from '../../../components/CorrelationRef.tsx'
import type { CareIcon } from '../../../packages/schema.ts'
import type { CareActionView, CareStatus } from '../view.ts'
import styles from './CareKeys.module.css'

const ICONS: Record<CareIcon, LucideIcon> = {
  apple: Apple,
  sparkles: Sparkles,
  moon: Moon,
  droplets: Droplets,
  compass: Compass,
  heart: Heart,
  brush: Brush,
}

interface CareKeysProps {
  creatureName: string
  actions: CareActionView[]
  status: CareStatus
  /** Explains why care is unavailable, e.g. an unknown package version. */
  unavailableReason: string | null
  onCare: (action: string) => void
  /** Explicit replay of the exact uncertain command (same body and key). */
  onRetry?: () => void
}

export function CareKeys({ creatureName, actions, status, unavailableReason, onCare, onRetry }: CareKeysProps) {
  const pending = status.kind === 'pending'
  const labelOf = (action: string) => actions.find((candidate) => candidate.action === action)?.label ?? action
  return (
    <section className={styles.care} aria-labelledby="care-heading">
      <h2 id="care-heading" className={styles.heading}>
        Care
      </h2>
      {unavailableReason ? (
        <p className={styles.unavailable}>{unavailableReason}</p>
      ) : (
        <div className={styles.keys}>
          {actions.map((action) => {
            const Icon = ICONS[action.icon]
            const busy = pending && status.action === action.action
            return (
              <button
                key={action.action}
                type="button"
                className={styles.key}
                disabled={pending}
                aria-busy={busy || undefined}
                onClick={() => onCare(action.action)}
              >
                <span className={styles.icon} aria-hidden="true">
                  {busy ? <LoaderCircle className={styles.spin} size={22} /> : <Icon size={22} />}
                </span>
                <span className={styles.label}>{busy ? `${action.progressive}…` : action.label}</span>
                <span className={styles.effects}>{action.effects.join(' · ')}</span>
              </button>
            )
          })}
        </div>
      )}
      <div className={styles.feedback} role="status" aria-live="polite">
        {status.kind === 'done' && (
          <div className={styles.done}>
            <p>
              <strong>{labelOf(status.action)} recorded.</strong>{' '}
              {status.changes.length > 0
                ? status.changes.map((change) => `${change.label} ${change.before} → ${change.after}`).join(' · ')
                : `${creatureName}'s state is unchanged.`}
            </p>
            <p className={styles.note}>Currency reward pending — your wallet updates separately.</p>
          </div>
        )}
        {status.kind === 'cooldown' && (
          <p className={styles.waiting}>
            <strong>{labelOf(status.action)} is cooling down.</strong>{' '}
            {status.retryAfterSeconds !== null
              ? `Try again in ${status.retryAfterSeconds} s.`
              : 'Try again shortly.'}
          </p>
        )}
        {status.kind === 'failed' && (
          <div className={styles.failed}>
            <p>
              <strong>{labelOf(status.action)} not confirmed.</strong> {status.message}
            </p>
            <div className={styles.failedActions}>
              {status.uncertain && onRetry && (
                <button type="button" className={styles.retry} onClick={onRetry}>
                  <RotateCcw size={16} aria-hidden="true" /> Retry same request
                </button>
              )}
              {status.correlationId && <CorrelationRef id={status.correlationId} />}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
