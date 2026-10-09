import { useEffect, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useApi } from '../../api/apiContext.ts'
import { ApiError } from '../../api/errors.ts'
import { apiPath } from '../../api/http.ts'
import { parseTime } from '../../lib/time.ts'
import { locationSchema, type OwnLocation } from './dto.ts'
import { dedupeMarkers, fetchNearbyBatch, NEARBY_LIMIT, type NearbyBatch } from './nearby.ts'

export const exploreKeys = {
  location: (userId: string) => ['user', userId, 'location'] as const,
  nearby: (userId: string, viewerTimestamp: string) => ['user', userId, 'nearby', { viewer: viewerTimestamp, limit: NEARBY_LIMIT }] as const,
}

/** Own latest accepted observation; 404 means none has been shared yet. */
export function useOwnLocation(userId: string) {
  const api = useApi()
  return useQuery({
    queryKey: exploreKeys.location(userId),
    staleTime: 15_000,
    queryFn: async ({ signal }): Promise<OwnLocation | null> => {
      try {
        return (
          await api.request({
            method: 'GET',
            path: apiPath`/map/v1/location/${userId}`,
            auth: 'user',
            parse: (value) => locationSchema.parse(value),
            signal,
          })
        ).data
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
  })
}

/**
 * True once the server expiry has passed: checked against the display clock on
 * every render and re-rendered exactly at the deadline, so stale pins never show.
 */
export function useExpired(expiresAt: string | null | undefined, now: number): boolean {
  const deadline = parseTime(expiresAt)
  const [expiredDeadline, setExpiredDeadline] = useState<number | null>(null)
  useEffect(() => {
    if (deadline === null) return
    const remaining = deadline - Date.now()
    const timer = window.setTimeout(() => setExpiredDeadline(deadline), Math.max(0, Math.min(remaining, 2_147_000_000)))
    return () => window.clearTimeout(timer)
  }, [deadline])
  return deadline !== null && (deadline <= now || expiredDeadline === deadline)
}

/**
 * Nearby markers bound to one unchanged viewer observation. No background polling:
 * refresh is manual. Each page of this query is a bounded batch of up to 20 pages.
 */
export function useNearby(userId: string, viewer: OwnLocation | null, enabled: boolean) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: exploreKeys.nearby(userId, viewer?.timestamp ?? 'none'),
    enabled: enabled && !!viewer,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => fetchNearbyBatch(api, userId, pageParam, signal),
    getNextPageParam: (last: NearbyBatch) => last.nextCursor,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
}

export function mergeBatches(batches: NearbyBatch[] | undefined) {
  const list = batches ?? []
  return {
    markers: dedupeMarkers(list.flatMap((batch) => batch.markers)),
    partial: list.some((batch) => batch.partial),
    restarted: list.some((batch) => batch.restarted),
    retrievedAt: list[0]?.retrievedAt ?? null,
  }
}
