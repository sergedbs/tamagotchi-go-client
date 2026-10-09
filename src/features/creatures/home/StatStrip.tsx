import type { StatRow } from '../view.ts'
import styles from './StatStrip.module.css'

/** Package-defined stats only; meters only where the package defines a range. */
export function StatStrip({ rows }: { rows: StatRow[] }) {
  if (rows.length === 0) return <p className={styles.empty}>This creature reports no package stats.</p>
  return (
    <dl className={styles.strip}>
      {rows.map((row) => (
        <div key={row.key} className={styles.stat}>
          <dt className={row.raw ? styles.rawLabel : styles.label}>{row.label}</dt>
          <dd className={styles.value}>
            <span className="tabular">{row.value}</span>
            {row.range && <span className={styles.max}>/ {row.range.max}</span>}
          </dd>
          {row.range && (
            <dd className={styles.meterCell}>
              <meter
                className={styles.meter}
                min={row.range.min}
                max={row.range.max}
                value={row.range.value}
                aria-label={`${row.label} ${row.value} of ${row.range.max}`}
              />
            </dd>
          )}
        </div>
      ))}
    </dl>
  )
}
