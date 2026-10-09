import { useState } from 'react'
import { Link } from 'react-router'
import { LogOut } from 'lucide-react'
import { Button } from '../../components/Button.tsx'
import { usePublicPackages } from '../auth/packagesApi.ts'
import { useAuthenticated, useSessionStore } from '../auth/sessionContext.ts'
import { JoinPackage } from './JoinPackage.tsx'
import styles from './AccountPage.module.css'

export default function AccountPage() {
  const { user } = useAuthenticated()
  const store = useSessionStore()
  const packages = usePublicPackages()
  const [leaving, setLeaving] = useState(false)
  const nameOf = (id: string) => packages.data?.items.find((pkg) => pkg.package_id === id)?.name ?? id

  return (
    <main className={styles.account}>
      <header className={styles.header}>
        <h1>{user.username}</h1>
        <p className={styles.muted}>{user.email}</p>
      </header>
      <section aria-labelledby="packages-heading" className={styles.section}>
        <h2 id="packages-heading">Packages</h2>
        <ul className={styles.list}>
          {user.package_ids.map((id) => (
            <li key={id}>{nameOf(id)}</li>
          ))}
        </ul>
        <JoinPackage user={user} />
      </section>
      <section aria-labelledby="session-heading" className={styles.section}>
        <h2 id="session-heading">Session</h2>
        <p className={styles.muted}>
          You stay signed in only while this tab is open. Reloading asks you to sign in again.
        </p>
        <Button
          variant="secondary"
          icon={<LogOut size={18} aria-hidden="true" />}
          busy={leaving}
          onClick={async () => {
            setLeaving(true)
            await store.logout()
          }}
        >
          Sign out
        </Button>
      </section>
      <p>
        <Link to="/credits">Credits and licenses</Link>
      </p>
    </main>
  )
}
