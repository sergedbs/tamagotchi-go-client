import { useState, type CSSProperties } from 'react'
import styles from './CreatureArt.module.css'

interface CreatureArtProps {
  /** Resolved, already validated image URL; null when the sprite is unresolved. */
  src: string | null
  /** Accessible name, e.g. the creature name. */
  alt: string
  /**
   * Rendered CSS size in px. Sprites are 200x200; avoid going far above that.
   * When omitted, the parent controls it through the --art-size custom property.
   */
  size?: number
  eager?: boolean
}

/** Licensed creature artwork with a deliberate, labelled fallback silhouette. */
export function CreatureArt({ src, alt, size, eager = false }: CreatureArtProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const sizing = size ? ({ '--art-size': `${size}px` } as CSSProperties) : undefined
  if (!src || failedSrc === src) return <ArtFallback style={sizing} compact={!!size && size < 96} name={alt} />
  return (
    <img
      className={styles.art}
      src={src}
      alt={alt}
      width={200}
      height={200}
      style={sizing}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      onError={() => setFailedSrc(src)}
    />
  )
}

function ArtFallback({ style, compact, name }: { style?: CSSProperties; compact: boolean; name: string }) {
  return (
    <figure className={styles.fallback} style={style} role="img" aria-label={`${name}: artwork unavailable`}>
      <svg viewBox="0 0 120 120" aria-hidden="true" className={styles.silhouette}>
        <path d="M34 50c-6-10-6-24 2-30 6 5 9 12 10 20 9-4 19-4 28 0 1-8 4-15 10-20 8 6 8 20 2 30 6 7 9 16 9 25 0 20-17 33-40 33S15 95 15 75c0-9 13-18 19-25Z" />
        <circle cx="47" cy="66" r="3.5" />
        <circle cx="73" cy="66" r="3.5" />
      </svg>
      {!compact && <figcaption className={styles.caption}>Artwork unavailable</figcaption>}
    </figure>
  )
}
