import { useEffect, useState } from 'react'
import { formatAbsolute, parseTime } from '../../lib/time.ts'

function format(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Display-only countdown to a server timestamp; it never decides an outcome. */
export function Countdown({ until, label }: { until: string | null; label: string }) {
  const target = parseTime(until)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (target === null) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [target])
  if (target === null) return null
  return (
    <span className="tabular" title={formatAbsolute(until)} aria-label={`${label}: ${format(target - now)}`}>
      {format(target - now)}
    </span>
  )
}
