import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import styles from './CorrelationRef.module.css'

/** Shows a correlation ID with a copy action, the link to external service logs. */
export function CorrelationRef({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }
  return (
    <span className={styles.ref}>
      <span>Reference</span>
      <code className={styles.code}>{id}</code>
      <button type="button" className={styles.copy} onClick={copy} aria-label="Copy reference">
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      </button>
      <span className="visually-hidden" aria-live="polite">
        {copied ? 'Reference copied' : ''}
      </span>
    </span>
  )
}
