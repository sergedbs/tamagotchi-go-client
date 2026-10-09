import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from '../../api/http.ts'
import { fakeFetch, jsonResponse, problem, testToken } from '../../api/testing.ts'
import { SessionStore } from './session.ts'

const USER = { user_id: 'u1', username: 'nia', email: 'nia@example.test', package_ids: ['p1'], membership_version: 1 }
const NOW = Date.parse('2026-10-09T12:00:00.000Z')

function tokens(n: number, expSeconds = NOW / 1000 + 900, roles: string[] = ['user']) {
  return {
    access_token: testToken({ sub: 'u1', exp: expSeconds, roles, n }),
    refresh_token: `refresh-${n}`,
    token_type: 'Bearer',
    expires_in: 900,
  }
}

async function signedIn(extra: Parameters<typeof fakeFetch>, now = () => NOW) {
  const { fetch, calls } = fakeFetch(() => jsonResponse(200, tokens(1)), () => jsonResponse(200, USER), ...extra)
  const store = new SessionStore({ baseUrl: '/api', fetchImpl: fetch, now })
  await store.login({ email: USER.email, password: 'correct horse battery', packageId: 'p1' })
  return { store, calls, fetch }
}

describe('SessionStore', () => {
  it('logs in publicly, then takes identity from /users/me', async () => {
    const { store, calls } = await signedIn([])
    expect(calls[0]).toMatchObject({ url: '/api/users/v1/users/login', method: 'POST', body: { email: USER.email, password: 'correct horse battery', package_id: 'p1' } })
    expect(calls[0]?.headers.Authorization).toBeUndefined()
    expect(calls[1]?.headers.Authorization).toBe(`Bearer ${tokens(1).access_token}`)
    expect(store.getSnapshot()).toMatchObject({ status: 'authenticated', user: USER, roles: ['user'], packageId: 'p1' })
  })

  it('stays anonymous when /users/me fails after login', async () => {
    const { fetch } = fakeFetch(() => jsonResponse(200, tokens(1)), () => jsonResponse(503, problem(503, 'auth_keys_unavailable')))
    const store = new SessionStore({ baseUrl: '/api', fetchImpl: fetch, now: () => NOW })
    await expect(store.login({ email: 'a@example.test', password: 'x', packageId: 'p1' })).rejects.toMatchObject({ code: 'auth_keys_unavailable' })
    expect(store.getSnapshot().status).toBe('anonymous')
    await expect(store.getAccessToken()).resolves.toBeNull()
  })

  it('refreshes shortly before expiry with one shared request and rotates both tokens', async () => {
    let now = NOW
    const { store, calls } = await signedIn([() => jsonResponse(200, tokens(2, NOW / 1000 + 1800))], () => now)
    now = NOW + 850_000
    const [a, b, c] = await Promise.all([store.getAccessToken(), store.getAccessToken(), store.getAccessToken()])
    expect(new Set([a, b, c])).toEqual(new Set([tokens(2, NOW / 1000 + 1800).access_token]))
    const refreshes = calls.filter((call) => call.url.endsWith('/auth/refresh'))
    expect(refreshes).toHaveLength(1)
    expect(refreshes[0]?.headers.Authorization).toBeUndefined()
    expect(refreshes[0]?.body).toEqual({ refresh_token: 'refresh-1' })
  })

  it('ends the session when refresh is refused, and stops there', async () => {
    const { store } = await signedIn([() => jsonResponse(401, problem(401, 'invalid_refresh_token'))])
    const listener = vi.fn()
    store.subscribe(listener)
    await expect(store.refreshAfterUnauthorized(tokens(1).access_token)).resolves.toBe(false)
    expect(store.getSnapshot()).toEqual({ status: 'anonymous', reason: 'expired' })
    expect(listener).toHaveBeenCalled()
    await expect(store.getAccessToken()).resolves.toBeNull()
  })

  it('keeps the session when refresh fails in transport', async () => {
    const { store } = await signedIn([() => jsonResponse(503, problem(503, 'too_many_tasks'))])
    await expect(store.refreshAfterUnauthorized(tokens(1).access_token)).rejects.toMatchObject({ status: 503 })
    expect(store.getSnapshot().status).toBe('authenticated')
  })

  it('treats a 401 for an already replaced token as refreshed', async () => {
    const { store } = await signedIn([])
    await expect(store.refreshAfterUnauthorized('some-older-token')).resolves.toBe(true)
  })

  it('works with the client: GET recovers after a single refresh', async () => {
    const { store, fetch, calls } = await signedIn([
      () => jsonResponse(401, problem(401, 'unauthorized')),
      () => jsonResponse(200, tokens(2)),
      () => jsonResponse(200, { items: [] }),
    ])
    const client = createApiClient({ baseUrl: '/api', session: store, fetchImpl: fetch })
    await expect(client.request({ method: 'GET', path: '/guild/v1/guilds', auth: 'user' })).resolves.toMatchObject({ data: { items: [] } })
    expect(calls.at(-1)?.headers.Authorization).toBe(`Bearer ${tokens(2).access_token}`)
  })

  it('logs out with the refresh token and no bearer, clearing even if unreachable', async () => {
    const ok = await signedIn([() => new Response(null, { status: 204 })])
    await expect(ok.store.logout()).resolves.toEqual({ revoked: true })
    const logoutCall = ok.calls.at(-1)
    expect(logoutCall).toMatchObject({ url: '/api/users/v1/auth/logout', body: { refresh_token: 'refresh-1' } })
    expect(logoutCall?.headers.Authorization).toBeUndefined()

    const offline = await signedIn([
      () => {
        throw new TypeError('Failed to fetch')
      },
    ])
    await expect(offline.store.logout()).resolves.toEqual({ revoked: false })
    expect(offline.store.getSnapshot()).toEqual({ status: 'anonymous', reason: 'signed_out', revocationConfirmed: false })
  })

  it('never touches browser storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    await signedIn([])
    expect(setItem).not.toHaveBeenCalled()
    expect(document.cookie).toBe('')
  })
})
