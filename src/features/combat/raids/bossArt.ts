import { findCatalogSprite, type SpriteCatalog } from '../../../packages/spriteCatalog.ts'

/**
 * Boss art comes from the client sprite catalog (there is no boss asset manifest
 * API). Unknown refs return null and render the deliberate fallback.
 */
export function bossArtUrl(catalog: SpriteCatalog | undefined, spriteRef: string | undefined): string | null {
  if (!spriteRef) return null
  return findCatalogSprite(catalog, spriteRef)?.url ?? null
}
