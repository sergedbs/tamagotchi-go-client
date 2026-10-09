import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../api/apiContext.ts'
import type { ApiClient, ApiResponse } from '../../api/http.ts'
import { packagePageSchema, type Package, type PackagePage } from './dto.ts'

const PAGE_LIMIT = 25
const MAX_PAGES = 10

export interface PublicPackages {
  items: Package[]
  /** More pages exist beyond the bounded read. */
  truncated: boolean
}

/** Public package list for onboarding; cursor walked with unchanged limit, bounded. */
export async function fetchPublicPackages(api: ApiClient, signal?: AbortSignal): Promise<PublicPackages> {
  const items: Package[] = []
  let cursor: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    const response: ApiResponse<PackagePage> = await api.request({
      method: 'GET',
      path: '/registry/v1/packages',
      auth: 'public',
      query: { limit: PAGE_LIMIT, cursor },
      parse: (value) => packagePageSchema.parse(value),
      signal,
    })
    items.push(...response.data.items)
    cursor = response.data.next_cursor
    if (!cursor) return { items, truncated: false }
  }
  return { items, truncated: true }
}

export function usePublicPackages() {
  const api = useApi()
  return useQuery({
    queryKey: ['public', 'packages', { limit: PAGE_LIMIT }],
    queryFn: ({ signal }) => fetchPublicPackages(api, signal),
    staleTime: 60_000,
  })
}

/** A package can onboard new players only once a configuration exists. */
export function canOnboard(pkg: Package): boolean {
  return pkg.status === 'active' && pkg.config_version !== null
}

export function packageLabel(pkg: Package): string {
  return `${pkg.name} (v${pkg.version})`
}
