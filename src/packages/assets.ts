import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { useApi } from '../api/apiContext.ts'
import { apiPath } from '../api/http.ts'

const assetsSchema = z.object({
  package_id: z.string(),
  config_version: z.number().int(),
  items: z.array(z.object({ sprite_ref: z.string(), url: z.string() })),
})
export type PackageAssets = z.output<typeof assetsSchema>

/**
 * Only https URLs or same-origin URLs are rendered. Plain http is accepted for the
 * page's own origin (local development serves fixture art from the client).
 */
export function safeAssetUrl(raw: string, pageOrigin: string = window.location.origin): string | null {
  let url: URL
  try {
    url = new URL(raw, pageOrigin)
  } catch {
    return null
  }
  if (url.username || url.password) return null
  if (url.protocol === 'https:') return url.href
  if (url.protocol === 'http:' && url.origin === pageOrigin) return url.href
  return null
}

/** Public asset manifest for one exact package configuration version. */
export function usePackageAssets(packageId: string | undefined, configVersion: number | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: ['public', 'package-assets', packageId, configVersion],
    enabled: !!packageId && !!configVersion,
    staleTime: 10 * 60_000,
    queryFn: async ({ signal }) =>
      (
        await api.request({
          method: 'GET',
          path: apiPath`/registry/v1/packages/${packageId!}/assets`,
          query: { config_version: configVersion },
          auth: 'public',
          parse: (value) => assetsSchema.parse(value),
          signal,
        })
      ).data,
  })
}

export function resolveSpriteUrl(assets: PackageAssets | undefined, spriteRef: string): string | null {
  const asset = assets?.items.find((item) => item.sprite_ref === spriteRef)
  return asset ? safeAssetUrl(asset.url) : null
}
