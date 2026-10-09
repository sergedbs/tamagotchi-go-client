const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const absolute = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Parses a server timestamp without string comparison; null for invalid input. */
export function parseTime(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

/** "2 minutes ago" / "in 4 minutes", relative to now. */
export function formatRelative(value: string | null | undefined, now: number): string {
  const ms = parseTime(value)
  if (ms === null) return 'unknown time'
  const seconds = Math.round((ms - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return relative.format(Math.round(seconds), 'second')
  if (abs < 45 * 60) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 22 * 3600) return relative.format(Math.round(seconds / 3600), 'hour')
  return relative.format(Math.round(seconds / 86400), 'day')
}

/** Locale display plus a UTC detail for title attributes. */
export function formatAbsolute(value: string | null | undefined): string {
  const ms = parseTime(value)
  if (ms === null) return 'Unknown time'
  return `${absolute.format(ms)} (${new Date(ms).toISOString()} UTC)`
}
