import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

export const SPRITE_CATALOG_URL = '/assets/creatures/lythbound/catalog.json'

const catalogSchema = z.object({
  pack: z.string(),
  artist: z.string(),
  concept_credit: z.string(),
  license: z.string(),
  license_url: z.url(),
  source_url: z.url(),
  modifications: z.string(),
  assets: z.array(
    z.object({
      sprite_ref: z.string().min(1),
      species: z.string(),
      variant: z.string(),
      url: z.string().startsWith('/assets/creatures/'),
      width: z.int().positive(),
      height: z.int().positive(),
    }),
  ),
})

export type SpriteCatalog = z.output<typeof catalogSchema>
export type CatalogSprite = SpriteCatalog['assets'][number]

export async function fetchSpriteCatalog(signal?: AbortSignal): Promise<SpriteCatalog> {
  const response = await fetch(SPRITE_CATALOG_URL, { signal, redirect: 'error', headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`Sprite catalog unavailable (HTTP ${response.status})`)
  return catalogSchema.parse(await response.json())
}

/** Bundled licensed artwork catalog; static for the lifetime of the page. */
export function useSpriteCatalog() {
  return useQuery({
    queryKey: ['static', 'sprite-catalog'],
    queryFn: ({ signal }) => fetchSpriteCatalog(signal),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function findCatalogSprite(catalog: SpriteCatalog | undefined, spriteRef: string): CatalogSprite | null {
  return catalog?.assets.find((asset) => asset.sprite_ref === spriteRef) ?? null
}
