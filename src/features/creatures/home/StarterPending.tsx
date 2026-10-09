import { Habitat } from '../../../components/Habitat.tsx'
import { Button } from '../../../components/Button.tsx'
import styles from './StarterPending.module.css'

interface StarterPendingProps {
  waiting: boolean
  onCheck: () => void
  checking: boolean
}

/** The server mints the starter after sign-up; the browser only waits and checks. */
export function StarterPending({ waiting, onCheck, checking }: StarterPendingProps) {
  return (
    <main className={styles.pending} aria-labelledby="starter-heading">
      <div className={styles.stage}>
        <Habitat type="NATURE" />
        <svg className={waiting ? `${styles.egg} ${styles.wobble}` : styles.egg} viewBox="0 0 120 150" aria-hidden="true">
          <ellipse cx="60" cy="140" rx="40" ry="7" className={styles.shadow} />
          <path className={styles.shell} d="M60 8c26 0 46 40 46 74 0 32-20 54-46 54S14 114 14 82C14 48 34 8 60 8Z" />
          <path className={styles.spot} d="M38 62c6-4 13-2 15 4s-3 12-9 13-11-2-12-7 1-8 6-10Z" />
          <path className={styles.spot} d="M76 96c5-2 11 0 12 5s-3 9-8 10-9-2-9-6 1-7 5-9Z" />
          <path className={styles.spot} d="M70 34c4-1 8 1 8 5s-3 6-6 6-6-2-6-5 1-5 4-6Z" />
        </svg>
      </div>
      <div className={styles.copy} role="status">
        <h1 id="starter-heading">{waiting ? 'Your starter is on its way' : 'Your starter has not arrived yet'}</h1>
        <p>
          {waiting
            ? 'The server creates your first companion right after sign-up. This usually takes a few seconds.'
            : 'It can take a little longer when the server is busy. Nothing is lost — check again in a moment.'}
        </p>
        {!waiting && (
          <Button variant="primary" onClick={onCheck} busy={checking}>
            Check again
          </Button>
        )}
      </div>
    </main>
  )
}
