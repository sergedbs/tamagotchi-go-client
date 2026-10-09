import styles from './BrandMark.module.css'

/** Companion-egg mark plus wordmark. */
export function BrandMark({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <span className={styles.brand}>
      <svg className={styles.mark} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path className={styles.shell} d="M16 2.5c6.6 0 11.5 7.6 11.5 15.4 0 7-5 11.6-11.5 11.6S4.5 24.9 4.5 17.9C4.5 10.1 9.4 2.5 16 2.5Z" />
        <rect className={styles.screen} x="9.5" y="10.5" width="13" height="10" rx="3" />
        <circle className={styles.eye} cx="14" cy="15.2" r="1.3" />
        <circle className={styles.eye} cx="18" cy="15.2" r="1.3" />
        <circle className={styles.key} cx="12.5" cy="24.5" r="1.4" />
        <circle className={styles.key} cx="16" cy="25.4" r="1.4" />
        <circle className={styles.key} cx="19.5" cy="24.5" r="1.4" />
      </svg>
      {withWordmark && <span className={styles.wordmark}>Tamagotchi Go</span>}
    </span>
  )
}
