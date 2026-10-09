import { Link } from 'react-router'
import styles from './Page.module.css'

/** Honest state for a planned destination whose feature is not part of this build. */
export function NotInThisBuild({ title }: { title: string }) {
  return (
    <main className={styles.page}>
      <h1>{title}</h1>
      <p className={styles.lead}>{title} is not part of this build yet. Nothing here is simulated.</p>
      <Link to="/creatures">Back to your creatures</Link>
    </main>
  )
}
