import type { Page, Route } from '@playwright/test'
import { json, type ApiHandler } from './network.ts'

/** Identified fixture identities and packages; never real accounts. */
export const GROVE = '01a11d09-0000-7000-8000-00000000a001'
export const ME = { user_id: '01a11e00-0000-7000-8000-000000000001', username: 'nia', email: 'nia@example.test', package_ids: [GROVE], membership_version: 1 }
export const CORRELATION = '01a11e47-c352-7320-9957-baa3f0722d52'

export function token(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode({ sub: ME.user_id, exp: Math.floor(Date.now() / 1000) + 900, roles: ['user'] })}.x`
}

export function problem(status: number, code: string) {
  return { type: 'about:blank', title: 'Error', status, detail: code, instance: '/v1/x', code, correlation_id: CORRELATION }
}

export const packagesPage = (route: Route) =>
  json(route, 200, {
    items: [{ package_id: GROVE, name: 'Grove Companions', description: '', version: '0.1.0', status: 'active', config_version: 1, developer_user_ids: [], moderator_user_ids: [], revision: 2 }],
    next_cursor: null,
  })

/** Serves client-config.json with an explicit presentation mapping for GROVE@1. */
export async function withGroveConfig(page: Page) {
  await page.route('**/client-config.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ package_presentations: { [GROVE]: { '1': 'grove-companions' } } }) }),
  )
}

export async function signIn(page: Page, api: Map<string, ApiHandler>, next = '/creatures') {
  api.set('GET /registry/v1/packages', packagesPage)
  api.set('POST /users/v1/users/login', (route) => json(route, 200, { access_token: token(), refresh_token: 'r1', token_type: 'Bearer', expires_in: 900 }))
  api.set('GET /users/v1/users/me', (route) => json(route, 200, ME))
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByLabel('Package').selectOption(GROVE)
  await page.getByLabel('Email').fill(ME.email)
  await page.getByLabel('Password').fill('fixture password')
  await page.getByRole('button', { name: 'Sign in' }).click()
}

export function creature(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: 'Mossling',
    origin_package_id: GROVE,
    config_version: 1,
    origin_owner_id: ME.user_id,
    holder_user_ids: [ME.user_id],
    role: 'PRIMARY',
    combat_type: 'NATURE',
    level: 2,
    xp: 40,
    sprite_ref: 'lythbound/wolfren/green',
    package_stats: { energy: 50, bond: 30, temperament: 'curious' },
    acquired_at: '2026-10-09T10:00:00.000Z',
    version: 3,
    ...overrides,
  }
}

export const assetsFor = (route: Route) =>
  json(route, 200, { package_id: GROVE, config_version: 1, items: [{ sprite_ref: 'lythbound/wolfren/green', url: '/assets/creatures/lythbound/wolfren/green.png' }] })
