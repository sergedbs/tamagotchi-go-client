import { describe, expect, it } from 'vitest'
import { createApiClient } from '../../api/http.ts'
import { fakeFetch, jsonResponse, problem } from '../../api/testing.ts'
import { fetchNearbyBatch } from './nearby.ts'

const session = { getAccessToken: async () => 't', refreshAfterUnauthorized: async () => false }

function marker(id: string, distance: number) {
  return { user_id: id, lat: 47, lng: 28, timestamp: '2026-10-09T12:00:00.000Z', distance_m: distance, relationship: 'stranger' }
}

function page(ids: string[], next: string | null, partial = false) {
  return { user_id: 'me', nearby: ids.map((id, index) => marker(id, index)), retrieved_at: '2026-10-09T12:00:01.000Z', next_cursor: next, partial, partial_reason: partial ? 'RELATIONSHIPS_UNAVAILABLE' : null }
}

describe('fetchNearbyBatch', () => {
  it('walks every page with the same limit and de-duplicates by user_id', async () => {
    const { fetch, calls } = fakeFetch(() => jsonResponse(200, page(['a', 'b'], 'c1')), () => jsonResponse(200, page(['b', 'c'], null, true)))
    const api = createApiClient({ baseUrl: '/api', session, fetchImpl: fetch })
    const batch = await fetchNearbyBatch(api, 'me', null)
    expect(batch.markers.map((m) => m.user_id)).toEqual(['a', 'b', 'c'])
    expect(batch).toMatchObject({ nextCursor: null, partial: true, partialReason: 'RELATIONSHIPS_UNAVAILABLE', restarted: false })
    expect(calls.map((call) => call.url)).toEqual(['/api/map/v1/location/nearby/me?limit=100', '/api/map/v1/location/nearby/me?limit=100&cursor=c1'])
  })

  it('stops after 20 pages and reports truncation', async () => {
    const handlers = Array.from({ length: 20 }, (_, index) => () => jsonResponse(200, page([`u${index}`], `c${index + 1}`)))
    const { fetch, calls } = fakeFetch(...handlers)
    const batch = await fetchNearbyBatch(createApiClient({ baseUrl: '', session, fetchImpl: fetch }), 'me', null)
    expect(calls).toHaveLength(20)
    expect(batch.markers).toHaveLength(20)
    expect(batch.nextCursor).toBe('c20')
  })

  it('restarts once from page one on cursor_stale, then surfaces a second one', async () => {
    const { fetch } = fakeFetch(
      () => jsonResponse(200, page(['a'], 'c1')),
      () => jsonResponse(409, problem(409, 'cursor_stale')),
      () => jsonResponse(200, page(['z'], null)),
    )
    const batch = await fetchNearbyBatch(createApiClient({ baseUrl: '', session, fetchImpl: fetch }), 'me', null)
    expect(batch.markers.map((m) => m.user_id)).toEqual(['z'])
    expect(batch.restarted).toBe(true)

    const twice = fakeFetch(
      () => jsonResponse(409, problem(409, 'cursor_stale')),
      () => jsonResponse(409, problem(409, 'cursor_stale')),
    )
    await expect(fetchNearbyBatch(createApiClient({ baseUrl: '', session, fetchImpl: twice.fetch }), 'me', null)).rejects.toMatchObject({ code: 'cursor_stale' })
  })

  it('reports a missing viewer location instead of an empty map', async () => {
    const { fetch } = fakeFetch(() => jsonResponse(409, problem(409, 'viewer_location_unavailable')))
    await expect(fetchNearbyBatch(createApiClient({ baseUrl: '', session, fetchImpl: fetch }), 'me', null)).rejects.toMatchObject({ code: 'viewer_location_unavailable' })
  })
})
