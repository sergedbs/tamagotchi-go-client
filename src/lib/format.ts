const integer = new Intl.NumberFormat('en', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('en', { maximumFractionDigits: 2 })

/** Formats server integers (XP, money). Values outside the JSON safe range are not trusted. */
export function formatInteger(value: number): string {
  return Number.isSafeInteger(value) ? integer.format(value) : '—'
}

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? decimal.format(value) : '—'
}

export function formatSigned(value: number): string {
  const text = formatNumber(Math.abs(value))
  return value < 0 ? `−${text}` : `+${text}`
}
