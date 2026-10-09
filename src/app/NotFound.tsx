import { Link } from 'react-router'
import styles from './Page.module.css'

export function NotFound() {
  return (
    <main className={styles.page}>
      <h1>Page not found</h1>
      <p className={styles.lead}>This address does not match a Tamagotchi Go screen.</p>
      <Link to="/creatures">Go to your creatures</Link>
    </main>
  )
}
