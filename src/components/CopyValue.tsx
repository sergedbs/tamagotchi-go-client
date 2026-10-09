import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import styles from './CopyValue.module.css'

/** An identifier shown as text with a copy action and a polite confirmation. */
export function CopyValue({ value, label, showLabel = true, compact = false, size = 'meta' }: { value: string; label: string; showLabel?: boolean; compact?: boolean; size?: 'meta' | 'body' }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }
  return (
    <span className={styles.ref} data-size={size}>
      {showLabel && <span className={styles.label}>{label}</span>}
      <code className={styles.code} title={compact ? value : undefined}>
        {compact ? `…${value.slice(-12)}` : value}
      </code>
      <button type="button" className={styles.copy} onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>
        {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      </button>
      <span className="visually-hidden" aria-live="polite">
        {copied ? `${label} copied` : ''}
      </span>
    </span>
  )
}
