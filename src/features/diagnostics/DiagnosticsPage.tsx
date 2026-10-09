import { Trash2 } from 'lucide-react'
import { NotFound } from '../../app/NotFound.tsx'
import { Button } from '../../components/Button.tsx'
import { CorrelationRef } from '../../components/CorrelationRef.tsx'
import { useActivity, useDiagnosticsRing } from './diagnosticsContext.ts'
import styles from './Diagnostics.module.css'

const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** Opt-in, redacted request activity for this tab only. */
export default function DiagnosticsPage() {
  const ring = useDiagnosticsRing()
  const activity = useActivity()
  if (!ring) return <NotFound />

  // Cancelled requests (navigation, unmount) are not failures.
  const failures = activity.filter((item) => item.outcome !== 'ok' && item.outcome !== 'aborted').length
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Diagnostics</h1>
          <p className={styles.lead}>
            The last {activity.length} of up to 100 API attempts in this tab: method, route template, status, duration, error code and correlation ID. No bodies, tokens,
            emails, locations or chat text are kept, and nothing is saved.
          </p>
        </div>
        <Button variant="secondary" icon={<Trash2 size={16} aria-hidden="true" />} disabled={activity.length === 0} onClick={ring.clear}>
          Clear
        </Button>
      </header>
      <p className={styles.summary} role="status">
        {activity.length === 0 ? 'No requests recorded yet.' : `${failures} of ${activity.length} attempts failed.`} Gateway health alone does not prove every service is integrated.
      </p>
      {activity.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="visually-hidden">Recent API attempts, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">Time</th>
                <th scope="col">Result</th>
                <th scope="col">Duration</th>
                <th scope="col">Correlation</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((item, index) => (
                <tr key={`${item.at}-${index}`} data-outcome={item.outcome === 'ok' ? 'ok' : item.outcome === 'aborted' ? 'cancelled' : 'failed'}>
                  <th scope="row">
                    <span className={styles.method}>{item.method}</span> <code>{item.route}</code>
                  </th>
                  <td data-label="Time" className="tabular">
                    {time.format(item.at)}
                  </td>
                  <td data-label="Result" className={styles.result}>
                    {item.outcome === 'aborted' ? 'cancelled' : (item.status ?? 'no response')}
                    {item.outcome !== 'ok' && item.outcome !== 'http' && item.outcome !== 'aborted' && <> · {item.outcome}</>}
                    {item.code && <> · {item.code}</>}
                  </td>
                  <td data-label="Duration" className="tabular">
                    {item.durationMs} ms
                  </td>
                  <td data-label="Correlation">{item.correlationId ? <CorrelationRef id={item.correlationId} label="Correlation ID" compact /> : <span className={styles.muted}>none</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
