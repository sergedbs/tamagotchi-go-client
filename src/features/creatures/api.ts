import { useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query'
import { useApi } from '../../api/apiContext.ts'
import { apiPath, type ApiResponse } from '../../api/http.ts'
import { collectionSchema, holdersSchema, primarySelectionSchema, tamagotchiSchema, type Collection, type Tamagotchi } from './dto.ts'

export const COLLECTION_LIMIT = 25

export const creatureKeys = {
  collection: (userId: string) => ['user', userId, 'collection', { limit: COLLECTION_LIMIT }] as const,
  primary: (userId: string) => ['user', userId, 'primary-selection'] as const,
  creature: (userId: string, id: string) => ['user', userId, 'tamagotchi', id] as const,
  holders: (userId: string, id: string) => ['user', userId, 'holders', id] as const,
}

/** Collection pages: primary from the first page, secondaries de-duplicated by id. */
export function useCollection(userId: string, options: { pollMs?: number | false; enabled?: boolean } = {}) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: creatureKeys.collection(userId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) =>
      (
        await api.request({
          method: 'GET',
          path: apiPath`/tamagotchi/v1/users/${userId}/collection`,
          query: { limit: COLLECTION_LIMIT, cursor: pageParam },
          auth: 'user',
          parse: (value) => collectionSchema.parse(value) as Collection,
          signal,
        })
      ).data,
    getNextPageParam: (last) => last.next_cursor,
    enabled: options.enabled ?? true,
    refetchInterval: options.pollMs ?? false,
    refetchIntervalInBackground: false,
  })
}

export function flattenCollection(pages: Collection[] | undefined): { primary: Tamagotchi | null; secondary: Tamagotchi[] } {
  if (!pages || pages.length === 0) return { primary: null, secondary: [] }
  const primary = pages[0]?.primary ?? null
  const seen = new Set(primary ? [primary.id] : [])
  const secondary: Tamagotchi[] = []
  for (const page of pages) {
    for (const creature of page.secondary) {
      if (seen.has(creature.id)) continue
      seen.add(creature.id)
      secondary.push(creature)
    }
  }
  return { primary, secondary }
}

export interface WithEtag<T> {
  value: T
  etag: string | null
}

function withEtag<T>(response: ApiResponse<T>): WithEtag<T> {
  return { value: response.data, etag: response.etag }
}

export function useCreature(userId: string, id: string) {
  const api = useApi()
  return useQuery({
    queryKey: creatureKeys.creature(userId, id),
    queryFn: async ({ signal }) =>
      withEtag(
        await api.request({
          method: 'GET',
          path: apiPath`/tamagotchi/v1/tamagotchis/${id}`,
          auth: 'user',
          parse: (value) => tamagotchiSchema.parse(value) as Tamagotchi,
          signal,
        }),
      ),
  })
}

export function useHolders(userId: string, id: string) {
  const api = useApi()
  return useQuery({
    queryKey: creatureKeys.holders(userId, id),
    queryFn: async ({ signal }) =>
      withEtag(
        await api.request({
          method: 'GET',
          path: apiPath`/tamagotchi/v1/tamagotchis/${id}/holders`,
          auth: 'user',
          parse: (value) => holdersSchema.parse(value),
          signal,
        }),
      ),
  })
}

/** Primary selection has its own version/ETag, distinct from any creature's. */
export function usePrimarySelection(userId: string, enabled = true) {
  const api = useApi()
  return useQuery({
    queryKey: creatureKeys.primary(userId),
    enabled,
    staleTime: 0,
    queryFn: async ({ signal }) =>
      withEtag(
        await api.request({
          method: 'GET',
          path: apiPath`/tamagotchi/v1/users/${userId}/collection/primary`,
          auth: 'user',
          parse: (value) => primarySelectionSchema.parse(value),
          signal,
        }),
      ),
  })
}

/** Applies an authoritative server creature state to every cached copy. */
export function applyCreatureState(queryClient: QueryClient, userId: string, next: Tamagotchi, etag?: string | null) {
  queryClient.setQueryData<{ pages: Collection[]; pageParams: unknown[] }>(creatureKeys.collection(userId), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            primary: page.primary?.id === next.id ? next : page.primary,
            secondary: page.secondary.map((creature) => (creature.id === next.id ? next : creature)),
          })),
        }
      : data,
  )
  // Never guess an ETag: a changed version without a returned ETag must be re-read.
  queryClient.setQueryData<WithEtag<Tamagotchi>>(creatureKeys.creature(userId, next.id), (current) => {
    if (!current) return current
    const sameVersion = current.value.version === next.version
    return { value: next, etag: etag !== undefined ? etag : sameVersion ? current.etag : null }
  })
}
