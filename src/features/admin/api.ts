import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { useApi } from '../../api/apiContext.ts'
import { apiPath } from '../../api/http.ts'
import { packageSchema } from '../auth/dto.ts'
import { bossSchema, occurrenceSchema } from '../combat/raids/api.ts'
import { withEtag } from '../creatures/api.ts'
import { LIST_LIMIT } from '../social/api.ts'

/** The publish reply; the echoed definition is not re-validated against the editor's schema. */
export const packageConfigSchema = z.object({ package_id: z.string(), config_version: z.number().int() })
export const occurrenceReceiptSchema = z.object({ occurrence: occurrenceSchema, runtime_propagation: z.string() })
const bossPageSchema = z.object({ items: z.array(bossSchema), next_cursor: z.string().nullable() })
const occurrencePageSchema = z.object({ items: z.array(occurrenceSchema), next_cursor: z.string().nullable() })

export const adminKeys = {
  package: (userId: string, packageId: string) => ['user', userId, 'admin-package', packageId] as const,
  bosses: (userId: string) => ['user', userId, 'admin-bosses', { limit: LIST_LIMIT }] as const,
  boss: (userId: string, bossId: string) => ['user', userId, 'admin-boss', bossId] as const,
  occurrences: (userId: string) => ['user', userId, 'admin-occurrences', { limit: LIST_LIMIT }] as const,
}

/** One package with its exact ETag for metadata edits (public read, always fresh). */
export function useAdminPackage(userId: string, packageId: string) {
  const api = useApi()
  return useQuery({
    queryKey: adminKeys.package(userId, packageId),
    staleTime: 0,
    queryFn: async ({ signal }) => withEtag(await api.request({ method: 'GET', path: apiPath`/registry/v1/packages/${packageId}`, auth: 'public', parse: (value) => packageSchema.parse(value), signal })),
  })
}

export function useAdminBosses(userId: string) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: adminKeys.bosses(userId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) =>
      (await api.request({ method: 'GET', path: '/registry/v1/bosses', query: { limit: LIST_LIMIT, cursor: pageParam }, auth: 'user', parse: (value) => bossPageSchema.parse(value), signal })).data,
    getNextPageParam: (last) => last.next_cursor,
    staleTime: 0,
  })
}

/** The current boss version with its ETag, for a full-definition PUT. */
export function useAdminBoss(userId: string, bossId: string) {
  const api = useApi()
  return useQuery({
    queryKey: adminKeys.boss(userId, bossId),
    staleTime: 0,
    queryFn: async ({ signal }) => withEtag(await api.request({ method: 'GET', path: apiPath`/registry/v1/bosses/${bossId}`, auth: 'user', parse: (value) => bossSchema.parse(value), signal })),
  })
}

export function useAdminOccurrences(userId: string) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: adminKeys.occurrences(userId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) =>
      (await api.request({ method: 'GET', path: '/registry/v1/raid-occurrences', query: { limit: LIST_LIMIT, cursor: pageParam }, auth: 'user', parse: (value) => occurrencePageSchema.parse(value), signal })).data,
    getNextPageParam: (last) => last.next_cursor,
    staleTime: 0,
  })
}
