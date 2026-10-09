import { Link, useLocation } from 'react-router'
import styles from './Combat.module.css'

export function CombatNav() {
  const { pathname } = useLocation()
  const raids = pathname.startsWith('/combat/raids')
  return (
    <nav className={styles.subnav} aria-label="Combat">
      <Link to="/combat/battles" aria-current={!raids ? 'page' : undefined}>
        Battles
      </Link>
      <Link to="/combat/raids" aria-current={raids ? 'page' : undefined}>
        Raids
      </Link>
    </nav>
  )
}
