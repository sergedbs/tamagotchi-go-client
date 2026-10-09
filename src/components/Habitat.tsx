import type { CombatType } from '../features/creatures/dto.ts'
import styles from './Habitat.module.css'

/**
 * Softly illustrated backdrop. Flat layered shapes tinted per combat type; purely
 * decorative, so it is hidden from assistive technology.
 */
export function Habitat({ type }: { type: CombatType | null }) {
  return (
    <svg
      className={styles.habitat}
      data-habitat={type ?? 'NEUTRAL'}
      viewBox="0 0 480 320"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="480" height="320" className={styles.sky} />
      <circle cx="322" cy="66" r="22" className={styles.sun} />
      <path className={styles.far} d="M0 178c46-26 98-36 150-22 38 10 64 4 104-14 52-22 112-24 160-2 26 12 46 16 66 12V320H0Z" />
      <path className={styles.near} d="M0 214c62-22 128-26 196-8 44 12 92 10 140-6 52-16 98-14 144 4V320H0Z" />
      <g className={styles.shrub}>
        <circle cx="40" cy="214" r="22" />
        <circle cx="68" cy="206" r="28" />
        <circle cx="98" cy="218" r="18" />
        <circle cx="412" cy="214" r="20" />
        <circle cx="440" cy="204" r="26" />
      </g>
      <path className={styles.ground} d="M0 252c84-14 172-20 240-20s156 6 240 20V320H0Z" />
      <g className={styles.pebble}>
        <ellipse cx="118" cy="276" rx="7" ry="3.5" />
        <ellipse cx="131" cy="280" rx="4" ry="2.5" />
        <ellipse cx="356" cy="282" rx="8" ry="4" />
        <ellipse cx="60" cy="300" rx="5" ry="2.5" />
        <ellipse cx="420" cy="304" rx="5" ry="2.5" />
      </g>
    </svg>
  )
}
