import type { Request, Route } from '@playwright/test'
import { expect, json, test } from './network.ts'
import { accountDefaults } from './session.ts'

const READY = '01a11d09-508b-7095-80e3-cb2c2db6eca5'
const UNCONFIGURED = '01a11d09-50b2-7413-ab6e-d6b6c25038df'
const USER = { user_id: '01a11e00-0000-7000-8000-000000000001', username: 'nia', email: 'nia@example.test', package_ids: [READY], membership_version: 1 }

function token(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode({ sub: USER.user_id, exp: Math.floor(Date.now() / 1000) + 900, roles: ['user'] })}.x`
}

const TOKENS = { access_token: token(), refresh_token: 'refresh-1', token_type: 'Bearer', expires_in: 900 }

function problem(status: number, code: string) {
  return { type: 'about:blank', title: 'Error', status, detail: `${code}`, instance: '/v1/x', code, correlation_id: '01a11e47-c352-7320-9957-baa3f0722d52' }
}

const packages = (route: Route) =>
  json(route, 200, {
    items: [
      { package_id: READY, name: 'Grove Companions', description: '', version: '0.1.0', status: 'active', config_version: 1, developer_user_ids: [], moderator_user_ids: [], revision: 2 },
      { package_id: UNCONFIGURED, name: 'Draft Pack', description: '', version: '0.0.1', status: 'active', config_version: null, developer_user_ids: [], moderator_user_ids: [], revision: 1 },
    ],
    next_cursor: null,
  })

test.describe('fixture: authentication', () => {
  test('signs in with a package and loads identity from /users/me', async ({ page, api }) => {
    const seen: Request[] = []
    api.set('GET /registry/v1/packages', packages)
    api.set('POST /users/v1/users/login', (route) => {
      seen.push(route.request())
      return json(route, 200, TOKENS)
    })
    api.set('GET /users/v1/users/me', (route) => {
      seen.push(route.request())
      return json(route, 200, USER)
    })
    accountDefaults(api, USER)
    await page.goto('/login?next=%2Faccount')
    await page.getByLabel('Package').selectOption(READY)
    await page.getByLabel('Email').fill(USER.email)
    await page.getByLabel('Password').fill('a long enough password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/account$/)
    await expect(page.getByRole('heading', { name: 'nia' })).toBeVisible()
    expect(seen[0]?.headers().authorization).toBeUndefined()
    expect(seen[0]?.postDataJSON()).toEqual({ email: USER.email, password: 'a long enough password', package_id: READY })
    expect(seen[1]?.headers().authorization).toBe(`Bearer ${TOKENS.access_token}`)
    expect(seen[1]?.headers()['x-correlation-id']).toMatch(/^[0-9a-f-]{14}7/)
  })

  test('distinguishes wrong credentials from missing package membership', async ({ page, api }) => {
    const answers = [problem(401, 'invalid_credentials'), problem(403, 'package_membership_required')]
    api.set('GET /registry/v1/packages', packages)
    api.set('POST /users/v1/users/login', (route) => {
      const body = answers.shift()!
      return json(route, body.status, body)
    })
    await page.goto('/login')
    await page.getByLabel('Package').selectOption(READY)
    await page.getByLabel('Email').fill(USER.email)
    await page.getByLabel('Password').fill('wrong password here')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.')
    await expect(page.getByLabel('Password')).toHaveValue('')
    await page.getByLabel('Password').fill('right password, wrong package')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toContainText('This account has not joined Grove Companions.')
  })

  test('waits out Retry-After on throttled sign-in', async ({ page, api }) => {
    api.set('GET /registry/v1/packages', packages)
    api.set('POST /users/v1/users/login', (route) => json(route, 429, problem(429, 'too_many_attempts'), { 'retry-after': '30' }))
    await page.goto('/login')
    await page.getByLabel('Package').selectOption(READY)
    await page.getByLabel('Email').fill(USER.email)
    await page.getByLabel('Password').fill('anything at all')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('button', { name: /Try again in \d+ s/ })).toBeDisabled()
    await expect(page.getByRole('alert')).toContainText('Too many attempts')
  })

  test('replays an uncertain registration with the exact same key and body', async ({ page, api }) => {
    const registrations: Request[] = []
    api.set('GET /registry/v1/packages', packages)
    api.set('POST /users/v1/users/register', (route) => {
      registrations.push(route.request())
      if (registrations.length === 1) return json(route, 504, problem(504, 'task_timeout'))
      return json(route, 201, { user: USER, global_currency: 0, starter_status: 'PENDING' })
    })
    api.set('POST /users/v1/users/login', (route) => json(route, 200, TOKENS))
    api.set('GET /users/v1/users/me', (route) => json(route, 200, USER))
    await page.goto('/register')
    await expect(page.getByRole('option', { name: /Draft Pack.*not ready/ })).toBeDisabled()
    await page.getByLabel('Package').selectOption(READY)
    await page.getByLabel('Username').fill('nia')
    await page.getByLabel('Email').fill(USER.email)
    await page.getByLabel('Password').fill('twelve chars plus')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('alert')).toContainText('We could not confirm your account was created.')
    await page.getByRole('button', { name: 'Retry same request' }).click()
    await expect(page).toHaveURL(/\/creatures$/)
    expect(registrations).toHaveLength(2)
    const [first, second] = registrations
    expect(first?.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{14}7/)
    expect(second?.headers()['idempotency-key']).toBe(first?.headers()['idempotency-key'])
    expect(second?.postData()).toBe(first?.postData())
    expect(second?.headers()['x-correlation-id']).not.toBe(first?.headers()['x-correlation-id'])
  })

  test('validates registration bounds before sending', async ({ page, api }) => {
    api.set('GET /registry/v1/packages', packages)
    await page.goto('/register')
    await page.getByLabel('Username').fill('ab')
    await page.getByLabel('Password').fill('short')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Use at least 3 characters.')).toBeVisible()
    await expect(page.getByText('Use at least 12 characters.')).toBeVisible()
    await expect(page.getByText('Choose a package to start in.')).toBeVisible()
  })

  test('signs out with the refresh token, and a reload requires signing in again', async ({ page, api }) => {
    let logoutRequest: Request | null = null
    api.set('GET /registry/v1/packages', packages)
    api.set('POST /users/v1/users/login', (route) => json(route, 200, TOKENS))
    api.set('GET /users/v1/users/me', (route) => json(route, 200, USER))
    api.set('POST /users/v1/auth/logout', (route) => {
      logoutRequest = route.request()
      return route.fulfill({ status: 204 })
    })
    accountDefaults(api, USER)
    await page.goto('/login?next=%2Faccount')
    await page.getByLabel('Package').selectOption(READY)
    await page.getByLabel('Email').fill(USER.email)
    await page.getByLabel('Password').fill('a long enough password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'nia' })).toBeVisible()

    await page.reload()
    await expect(page).toHaveURL(/\/login\?next=%2Faccount$/)

    await page.getByLabel('Package').selectOption(READY)
    await page.getByLabel('Email').fill(USER.email)
    await page.getByLabel('Password').fill('a long enough password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText('You are signed out.')).toBeVisible()
    const sent = logoutRequest as Request | null
    expect(sent?.headers().authorization).toBeUndefined()
    expect(sent?.postDataJSON()).toEqual({ refresh_token: 'refresh-1' })
    const storage = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookie: document.cookie }))
    expect(storage).toEqual({ local: 0, session: 0, cookie: '' })
  })
})
