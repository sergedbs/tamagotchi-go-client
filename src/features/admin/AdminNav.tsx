import { Link, useLocation } from 'react-router'
import styles from './Admin.module.css'

const SECTIONS = [
  { to: '/admin/packages', label: 'Packages' },
  { to: '/admin/bosses', label: 'Bosses' },
  { to: '/admin/occurrences', label: 'Occurrences' },
]

export function AdminNav() {
  const { pathname } = useLocation()
  return (
    <nav className={styles.subnav} aria-label="Administration">
      {SECTIONS.map((section) => (
        <Link key={section.to} to={section.to} aria-current={pathname.startsWith(section.to) ? 'page' : undefined}>
          {section.label}
        </Link>
      ))}
    </nav>
  )
}
