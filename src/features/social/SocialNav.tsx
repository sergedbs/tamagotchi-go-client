import { Link, useLocation } from 'react-router'
import styles from './Social.module.css'

/** People and guilds live under the Social destination. */
export function SocialNav() {
  const { pathname } = useLocation()
  const guilds = pathname.startsWith('/guilds')
  return (
    <nav className={styles.subnav} aria-label="Social">
      <Link to="/social" aria-current={!guilds ? 'page' : undefined}>
        People
      </Link>
      <Link to="/guilds" aria-current={guilds ? 'page' : undefined}>
        Guilds
      </Link>
    </nav>
  )
}
