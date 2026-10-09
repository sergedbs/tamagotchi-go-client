import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { CorrelationRef } from './CorrelationRef.tsx'
import styles from './FormAlert.module.css'

/** Inline, persistent feedback for a failed action; never only a toast. */
export function FormAlert({ title, children, correlationId, tone = 'error' }: { title: string; children?: ReactNode; correlationId?: string | null; tone?: 'error' | 'info' }) {
  return (
    <div className={tone === 'error' ? styles.error : styles.info} role={tone === 'error' ? 'alert' : 'status'}>
      {tone === 'error' && <AlertTriangle size={20} aria-hidden="true" className={styles.icon} />}
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.text}>{children}</div>}
        {correlationId && <CorrelationRef id={correlationId} />}
      </div>
    </div>
  )
}
