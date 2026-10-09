import { useQuery, type QueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useApi } from '../../api/apiContext.ts'
import { apiPath, type ApiClient, type ApiResponse } from '../../api/http.ts'

export const LIST_LIMIT = 25
const MAX_PAGES = 10

export const relationshipItemSchema = z.object({ user_id: z.string(), relationship: z.enum(['friend', 'enemy']) })
export type RelationshipItem = z.output<typeof relationshipItemSchema>
const relationshipPageSchema = z.object({ items: z.array(relationshipItemSchema), next_cursor: z.string().nullable() })

export const friendRequestSchema = z.object({
  request_id: z.string(),
  from_user_id: z.string(),
  to_user_id: z.string(),
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED']),
  expires_at: z.string(),
})
export type FriendRequest = z.output<typeof friendRequestSchema>
const friendRequestPageSchema = z.object({ items: z.array(friendRequestSchema), next_cursor: z.string().nullable() })

export const relationshipSchema = z.object({
  relationship: z.enum(['friend', 'enemy', 'stranger']),
  reverse_relationship: z.enum(['friend', 'enemy', 'stranger']),
  version: z.number().int(),
})

export const socialKeys = {
  relationships: (userId: string) => ['user', userId, 'relationships', { limit: LIST_LIMIT }] as const,
  friendRequests: (userId: string) => ['user', userId, 'friend-requests', { limit: LIST_LIMIT }] as const,
}

export interface Bounded<T> {
  items: T[]
  truncated: boolean
}

/** Walks a cursor list with unchanged limit, bounded; truncation is reported. */
export async function readAll<T>(
  api: ApiClient,
  path: string,
  parse: (value: unknown) => { items: T[]; next_cursor: string | null },
  signal?: AbortSignal,
): Promise<Bounded<T>> {
  const items: T[] = []
  let cursor: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    const response: ApiResponse<{ items: T[]; next_cursor: string | null }> = await api.request({
      method: 'GET',
      path,
      query: { limit: LIST_LIMIT, cursor },
      auth: 'user',
      parse,
      signal,
    })
    items.push(...response.data.items)
    cursor = response.data.next_cursor
    if (!cursor) return { items, truncated: false }
  }
  return { items, truncated: true }
}

export function useRelationships(userId: string) {
  const api = useApi()
  return useQuery({
    queryKey: socialKeys.relationships(userId),
    // Other players change these (accepting, unfriending): revalidate on every view.
    staleTime: 0,
    queryFn: ({ signal }) => readAll(api, apiPath`/users/v1/users/${userId}/relationships`, (value) => relationshipPageSchema.parse(value), signal),
  })
}

export function useFriendRequests(userId: string) {
  const api = useApi()
  return useQuery({
    queryKey: socialKeys.friendRequests(userId),
    staleTime: 0,
    queryFn: ({ signal }) => readAll(api, '/users/v1/friend-requests', (value) => friendRequestPageSchema.parse(value), signal),
  })
}

/** After any relationship mutation, reconcile both lists from the server. */
export function reconcileSocial(queryClient: QueryClient, userId: string) {
  void queryClient.invalidateQueries({ queryKey: ['user', userId, 'relationships'] })
  void queryClient.invalidateQueries({ queryKey: ['user', userId, 'friend-requests'] })
  void queryClient.invalidateQueries({ queryKey: ['user', userId, 'nearby'] })
}

/** My view only: the reverse relationship is never inferred for browser callers. */
export function relationshipWith(items: RelationshipItem[] | undefined, otherId: string): 'friend' | 'enemy' | 'stranger' {
  return items?.find((item) => item.user_id === otherId)?.relationship ?? 'stranger'
}

export function pendingRequestWith(requests: FriendRequest[] | undefined, me: string, otherId: string) {
  const pending = requests?.filter((request) => request.status === 'PENDING') ?? []
  return {
    incoming: pending.find((request) => request.from_user_id === otherId && request.to_user_id === me) ?? null,
    outgoing: pending.find((request) => request.from_user_id === me && request.to_user_id === otherId) ?? null,
  }
}
