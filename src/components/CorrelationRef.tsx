import { CopyValue } from './CopyValue.tsx'

/** Shows a correlation ID with a copy action, the link to external service logs. */
export function CorrelationRef({ id, label = 'Reference', compact = false }: { id: string; label?: string; compact?: boolean }) {
  return <CopyValue value={id} label={label} showLabel={label === 'Reference'} compact={compact} />
}
