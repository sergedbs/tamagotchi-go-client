import { Link, Outlet, useLocation } from 'react-router'
import { BrandMark } from '../components/BrandMark.tsx'
import { DESTINATIONS, UTILITIES, isActive, type NavItem } from './navigation.ts'
import styles from './AppShell.module.css'

const LINK_CLASS = { rail: styles.railLink, bar: styles.barLink, utility: styles.utilityLink }

function NavEntry({ item, pathname, variant }: { item: NavItem; pathname: string; variant: 'rail' | 'bar' | 'utility' }) {
  const active = isActive(item, pathname)
  const Icon = item.icon
  return (
    <Link
      to={item.to}
      className={LINK_CLASS[variant]}
      aria-current={active ? 'page' : undefined}
      aria-label={variant === 'utility' ? item.label : undefined}
      title={variant === 'utility' ? item.label : undefined}
    >
      <Icon size={variant === 'bar' ? 24 : 20} strokeWidth={active ? 2.25 : 2} aria-hidden="true" />
      {variant !== 'utility' && <span>{item.label}</span>}
    </Link>
  )
}

export function AppShell() {
  const { pathname } = useLocation()
  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <header className={styles.top}>
        <div className={styles.rail}>
          <Link to="/creatures" className={styles.home} aria-label="Tamagotchi Go home">
            <BrandMark />
          </Link>
          <nav className={styles.railNav} aria-label="Main">
            {DESTINATIONS.map((item) => (
              <NavEntry key={item.to} item={item} pathname={pathname} variant="rail" />
            ))}
          </nav>
          <nav className={styles.utilities} aria-label="Utilities">
            {UTILITIES.map((item) => (
              <NavEntry key={item.to} item={item} pathname={pathname} variant="utility" />
            ))}
          </nav>
        </div>
      </header>
      <div id="main" className={styles.main} tabIndex={-1}>
        <Outlet />
      </div>
      <nav className={styles.bottom} aria-label="Main">
        {DESTINATIONS.map((item) => (
          <NavEntry key={item.to} item={item} pathname={pathname} variant="bar" />
        ))}
      </nav>
    </div>
  )
}
