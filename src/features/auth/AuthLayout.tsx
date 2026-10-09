import { Link, Outlet } from 'react-router'
import { BrandMark } from '../../components/BrandMark.tsx'
import { CreatureArt } from '../../components/CreatureArt.tsx'
import { Habitat } from '../../components/Habitat.tsx'
import { findCatalogSprite, useSpriteCatalog } from '../../packages/spriteCatalog.ts'
import styles from './AuthLayout.module.css'

/** Welcome illustration only: catalog artwork, not account data. */
const WELCOME_SPRITES = ['lythbound/wolfren/green', 'lythbound/laguna/blue']

export function AuthLayout() {
  const catalog = useSpriteCatalog()
  return (
    <div className={styles.layout}>
      <div className={styles.scene} aria-hidden="true">
        <Habitat type="NATURE" />
        <div className={styles.creatures}>
          {WELCOME_SPRITES.map((ref, index) => (
            <span key={ref} className={index === 0 ? styles.lead : styles.friend}>
              <CreatureArt src={catalog.data ? (findCatalogSprite(catalog.data, ref)?.url ?? null) : null} alt="" eager />
            </span>
          ))}
        </div>
      </div>
      <main className={styles.panel}>
        <Link to="/login" className={styles.brand} aria-label="Tamagotchi Go">
          <BrandMark />
        </Link>
        <Outlet />
        <p className={styles.footer}>
          <Link to="/credits">Credits</Link>
        </p>
      </main>
    </div>
  )
}
