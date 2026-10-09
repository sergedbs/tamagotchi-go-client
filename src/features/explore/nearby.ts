import { ApiError } from '../../api/errors.ts'
import { apiPath, type ApiClient } from '../../api/http.ts'
import { nearbySchema, type Marker } from './dto.ts'

export const NEARBY_LIMIT = 100
export const PAGES_PER_REFRESH = 20

export interface NearbyBatch {
  markers: Marker[]
  /** Continuation after the bounded batch; non-null means results were truncated. */
  nextCursor: string | null
  partial: boolean
  partialReason: string | null
  retrievedAt: string | null
  restarted: boolean
}

/** Keeps the first marker per user_id (server order is distance, then user_id). */
export function dedupeMarkers(markers: Marker[]): Marker[] {
  const seen = new Set<string>()
  return markers.filter((marker) => {
    if (seen.has(marker.user_id)) return false
    seen.add(marker.user_id)
    return true
  })
}

/**
 * Reads up to 20 pages of 100 with unchanged caller, filters and limit. A stale
 * cursor restarts from page one once per refresh; a second one is surfaced.
 */
export async function fetchNearbyBatch(api: ApiClient, userId: string, startCursor: string | null, signal?: AbortSignal): Promise<NearbyBatch> {
  let restarted = false
  for (;;) {
    const markers: Marker[] = []
    let cursor = startCursor
    let partial = false
    let partialReason: string | null = null
    let retrievedAt: string | null = null
    try {
      for (let page = 0; page < PAGES_PER_REFRESH; page++) {
        const { data } = await api.request({
          method: 'GET',
          path: apiPath`/map/v1/location/nearby/${userId}`,
          query: { limit: NEARBY_LIMIT, cursor },
          auth: 'user',
          parse: (value) => nearbySchema.parse(value),
          signal,
        })
        markers.push(...data.nearby)
        partial ||= data.partial
        partialReason ??= data.partial_reason
        retrievedAt ??= data.retrieved_at
        cursor = data.next_cursor
        if (!cursor) break
      }
      return { markers: dedupeMarkers(markers), nextCursor: cursor, partial, partialReason, retrievedAt, restarted }
    } catch (error) {
      const stale = error instanceof ApiError && error.code === 'cursor_stale'
      if (stale && !restarted && startCursor === null) {
        restarted = true
        continue
      }
      throw error
    }
  }
}
