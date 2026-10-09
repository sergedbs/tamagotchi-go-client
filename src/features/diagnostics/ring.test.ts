import { describe, expect, it, vi } from 'vitest'
import type { Activity } from '../../api/activity.ts'
import { sendRequest } from '../../api/http.ts'
import { ActivityRing, RING_CAPACITY } from './ring.ts'

const activity = (n: number): Activity => ({ at: n, method: 'GET', route: '/x', status: 200, durationMs: 1, outcome: 'ok', code: null, correlationId: null })

describe('ActivityRing', () => {
  it('keeps only the newest 100 records, newest first', () => {
    const ring = new ActivityRing()
    for (let n = 0; n < 130; n++) ring.record(activity(n))
    expect(ring.snapshot()).toHaveLength(RING_CAPACITY)
    expect(ring.snapshot()[0]!.at).toBe(129)
    expect(ring.snapshot().at(-1)!.at).toBe(30)
  })

  it('notifies subscribers and clears', () => {
    const ring = new ActivityRing()
    const listener = vi.fn()
    ring.subscribe(listener)
    ring.record(activity(1))
    ring.clear()
    expect(listener).toHaveBeenCalledTimes(2)
    expect(ring.snapshot()).toEqual([])
  })
})

describe('transport activity', () => {
  it('records a redacted attempt: template route, status, code and correlation only', async () => {
    const ring = new ActivityRing()
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ type: 'about:blank', title: 'Conflict', status: 409, code: 'version_conflict', correlation_id: '01a11e47-c352-7320-9957-baa3f0722d52' }), {
        status: 409,
        headers: { 'content-type': 'application/problem+json', 'x-correlation-id': '01a11e47-c352-7320-9957-baa3f0722d52' },
      }),
    )
    await expect(
      sendRequest(
        { method: 'PUT', path: '/notification/v1/users/01a11e00-0000-7000-8000-000000000001/preferences', query: { email: 'nia@example.test' }, body: { secret: 'x' }, auth: 'user' },
        { baseUrl: '/api', accessToken: 'token-value', fetchImpl, observe: ring.record },
      ),
    ).rejects.toThrow()
    const [record] = ring.snapshot()
    expect(record).toMatchObject({ method: 'PUT', route: '/notification/v1/users/:id/preferences', status: 409, outcome: 'http', code: 'version_conflict', correlationId: '01a11e47-c352-7320-9957-baa3f0722d52' })
    const text = JSON.stringify(record)
    for (const secret of ['token-value', 'nia@example.test', 'secret', '01a11e00-0000-7000-8000-000000000001']) expect(text).not.toContain(secret)
  })
})
