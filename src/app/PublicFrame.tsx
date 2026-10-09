import { Link, Outlet } from 'react-router'
import { BrandMark } from '../components/BrandMark.tsx'
import { useSession } from '../features/auth/sessionContext.ts'
import { AppShell } from './AppShell.tsx'
import styles from './PublicFrame.module.css'

/** Signed in: the normal shell. Signed out: a quiet frame with a way to sign in. */
export function ShellOrPublic() {
  const session = useSession()
  if (session.status === 'authenticated') return <AppShell />
  return (
    <div className={styles.frame}>
      <header className={styles.top}>
        <Link to="/login" className={styles.brand} aria-label="Tamagotchi Go sign in">
          <BrandMark />
        </Link>
        <Link to="/login">Sign in</Link>
      </header>
      <Outlet />
    </div>
  )
}
