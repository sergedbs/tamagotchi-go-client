import { useEffect, useState } from 'react'

/** Seconds left of a server-supplied Retry-After window (429); 0 when free. */
export function useRetryAfter() {
  const [until, setUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (until === null) return
    const timer = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= until) setUntil(null)
    }, 500)
    return () => window.clearInterval(timer)
  }, [until])
  const remaining = until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000))
  return {
    remaining,
    wait: (seconds: number | null) => {
      if (!seconds) return
      const start = Date.now()
      setNow(start)
      setUntil(start + seconds * 1000)
    },
  }
}
