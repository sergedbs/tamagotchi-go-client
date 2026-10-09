import { expect, test } from '@playwright/test'
import { requireRealTarget } from './target.ts'

test.beforeAll(() => {
  requireRealTarget()
})

test.describe('real: gateway through the same-origin proxy', () => {
  test('health and readiness are API JSON', async ({ request }) => {
    const health = await request.get('/api/health')
    expect(health.status()).toBe(200)
    expect(await health.json()).toEqual({ status: 'UP' })
    const ready = await request.get('/api/ready')
    expect([200, 503]).toContain(ready.status())
    expect(ready.headers()['content-type']).toMatch(/json/)
  })

  test('unauthenticated API errors stay Problem JSON, never index.html', async ({ request }) => {
    const me = await request.get('/api/users/v1/users/me')
    expect(me.status()).toBe(401)
    expect(me.headers()['content-type']).toMatch(/application\/problem\+json/)
    const unknown = await request.get('/api/does-not-exist/v1/anything')
    expect(unknown.status()).toBeGreaterThanOrEqual(400)
    expect(await unknown.text()).not.toContain('<!doctype html>')
  })

  test('public package and type reads work signed out', async ({ request }) => {
    const packages = await request.get('/api/registry/v1/packages?limit=25')
    expect(packages.status()).toBe(200)
    expect(Array.isArray((await packages.json()).items)).toBe(true)
    const types = await request.get('/api/tamagotchi/v1/types')
    expect(types.status()).toBe(200)
  })
})
