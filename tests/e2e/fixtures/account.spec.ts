import type { Page, Request } from '@playwright/test'
import { expect, json, test, type ApiHandler } from './network.ts'
import { assetsFor, creature, GROVE, ME, problem, signIn } from './session.ts'

const TIDE = '01a11d09-0000-7000-8000-00000000a002'
const MOSS = '01a11f00-0000-7000-8000-00000000c001'
const RIPPLE = '01a11f00-0000-7000-8000-00000000c002'
const DEVICE = '01a15000-0000-7000-8000-00000000d001'

const pkg = (package_id: string, name: string) => ({ package_id, name, description: '', version: '0.1.0', status: 'active', config_version: 1, developer_user_ids: [], moderator_user_ids: [], revision: 2 })
const packages = (route: Parameters<ApiHandler>[0]) => json(route, 200, { items: [pkg(GROVE, 'Grove Companions'), pkg(TIDE, 'Tidewater Companions')], next_cursor: null })

/** Reads every Account section makes, with overridable defaults. */
function accountReads(api: Map<string, ApiHandler>, preferences = { muted_categories: [] as string[], version: 1 }) {
  api.set('GET /registry/v1/packages', packages)
  api.set(`GET /users/v1/users/${ME.user_id}/currency/global`, (route) => json(route, 200, { user_id: ME.user_id, package_id: null, amount: 1250 }))
  api.set(`GET /users/v1/users/${ME.user_id}/currency/local/${GROVE}`, (route) => json(route, 200, { user_id: ME.user_id, package_id: GROVE, amount: 37 }))
  api.set(`GET /users/v1/users/${ME.user_id}/currency/local/${TIDE}`, (route) => json(route, 200, { user_id: ME.user_id, package_id: TIDE, amount: 0 }))
  api.set(`GET /notification/v1/users/${ME.user_id}/preferences`, (route) => json(route, 200, preferences, { etag: `"${preferences.version}"` }))
  api.set('GET /notification/v1/devices', (route) => json(route, 200, { items: [], next_cursor: null }))
}

test.describe('fixture: account', () => {
  test('wallets show server balances for global coins and each package', async ({ page, api }) => {
    accountReads(api)
    await signIn(page, api, '/account')
    const wallets = page.getByRole('region', { name: 'Wallets' })
    await expect(wallets.getByRole('listitem').filter({ hasText: 'Coins' })).toContainText('1,250')
    await expect(wallets.getByRole('listitem').filter({ hasText: 'Grove Companions' })).toContainText('37')
    await expect(page.getByText('No devices are registered.')).toBeVisible()
    await expect(page.getByRole('banner').or(page.locator('main header')).getByText(ME.user_id)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy player id' })).toBeVisible()
  })

  test('preferences save with the exact ETag; a conflict reloads before saving again', async ({ page, api }) => {
    const sent: Request[] = []
    let current = { muted_categories: ['PLAYER_NEARBY'], version: 4 }
    accountReads(api)
    api.set(`GET /notification/v1/users/${ME.user_id}/preferences`, (route) => json(route, 200, current, { etag: `"${current.version}"` }))
    api.set(`PUT /notification/v1/users/${ME.user_id}/preferences`, (route) => {
      sent.push(route.request())
      if (sent.length === 1) {
        current = { muted_categories: ['PLAYER_NEARBY', 'RAID_STARTED'], version: 5 }
        return json(route, 412, problem(412, 'precondition_failed'))
      }
      current = { ...(route.request().postDataJSON() as { muted_categories: string[] }), version: 6 }
      return json(route, 200, current, { etag: '"6"' })
    })
    await signIn(page, api, '/account')

    const section = page.getByRole('region', { name: 'Notification categories' })
    await expect(section.getByLabel('Nearby players')).not.toBeChecked()
    await section.getByLabel('Battle challenges').uncheck()
    await section.getByRole('button', { name: 'Save preferences' }).click()
    await expect(section.getByText('They changed elsewhere and have been reloaded.')).toBeVisible()
    await expect(section.getByLabel('Raid starts')).not.toBeChecked()
    await expect(section.getByLabel('Battle challenges')).toBeChecked()

    await section.getByLabel('Battle challenges').uncheck()
    await section.getByRole('button', { name: 'Save preferences' }).click()
    await expect(section.getByText('Preferences saved.')).toBeVisible()

    expect(sent.map((request) => request.headers()['if-match'])).toEqual(['"4"', '"5"'])
    expect(sent[0]!.postDataJSON()).toEqual({ muted_categories: ['PLAYER_NEARBY', 'BATTLE_REQUEST'] })
    expect(sent[1]!.postDataJSON()).toEqual({ muted_categories: ['PLAYER_NEARBY', 'BATTLE_REQUEST', 'RAID_STARTED'] })
  })

  test('a registered device is removed only after confirmation', async ({ page, api }) => {
    let removed = false
    accountReads(api)
    api.set('GET /notification/v1/devices', (route) =>
      json(route, 200, { items: removed ? [] : [{ id: DEVICE, user_id: ME.user_id, platform: 'ANDROID', package_id: GROVE, locale: 'en-US', registered_at: '2026-10-01T10:00:00.000Z' }], next_cursor: null }),
    )
    api.set(`DELETE /notification/v1/devices/${DEVICE}`, (route) => {
      removed = true
      return route.fulfill({ status: 204 })
    })
    await signIn(page, api, '/account')
    const devices = page.getByRole('region', { name: 'Push devices' })
    await expect(devices.getByText('Android')).toBeVisible()
    await devices.getByRole('button', { name: 'Remove' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Remove device' }).click()
    await expect(devices.getByText('No devices are registered.')).toBeVisible()
  })

  test('joining a package waits for its server-created starter', async ({ page, api }) => {
    let joined = false
    let reads = 0
    accountReads(api)
    api.set(`GET /tamagotchi/v1/users/${ME.user_id}/collection`, (route) => {
      if (joined) reads += 1
      const secondary = joined && reads >= 2 ? [creature(RIPPLE, { name: 'Ripple', role: 'SECONDARY', origin_package_id: TIDE })] : []
      return json(route, 200, { user_id: ME.user_id, primary: creature(MOSS), secondary, next_cursor: null, retrieved_at: '2026-10-09T10:00:00.000Z' })
    })
    api.set(`GET /registry/v1/packages/${GROVE}/assets`, assetsFor)
    api.set('POST /users/v1/users/me/packages', (route) => {
      expect(route.request().postDataJSON()).toEqual({ package_id: TIDE })
      expect(route.request().headers()['idempotency-key']).toBeTruthy()
      joined = true
      return json(route, 200, { ...ME, package_ids: [GROVE, TIDE], membership_version: 2 })
    })
    await signIn(page, api, '/account')

    await page.getByLabel('Join another package').selectOption({ label: 'Tidewater Companions (v0.1.0)' })
    await page.getByRole('button', { name: 'Join package' }).click()
    await expect(page.getByText('Its starter creature is being created by the server…')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ripple' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('region', { name: 'Packages' }).getByRole('listitem')).toHaveText(['Grove Companions', 'Tidewater Companions'])
    await expect(page.getByRole('region', { name: 'Wallets' }).getByRole('listitem').filter({ hasText: 'Tidewater Companions' })).toContainText('0')
  })
})

const OWNER_KEY = 'tamagotchi-go.push-owner'
const OTHER_USER = '01a11e00-0000-7000-8000-000000000099'
/** Placeholder public values; nothing in these tests may reach Google. */
const PUSH = { firebase: { apiKey: 'fixture-api-key', projectId: 'fixture-project', messagingSenderId: '000000000000', appId: '1:000000000000:web:fixture' }, vapid_key: 'B'.padEnd(87, 'x') }
const webDevice = { id: DEVICE, user_id: ME.user_id, platform: 'WEB', package_id: GROVE, locale: 'en-US', registered_at: '2026-10-09T10:00:00.000Z' }

async function withPush(page: Page) {
  const providerCalls: string[] = []
  await page.route('**/client-config.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ push: PUSH }) }))
  await page.route(/googleapis\.com|gstatic\.com/, (route) => {
    providerCalls.push(new URL(route.request().url()).host)
    return route.abort()
  })
  return providerCalls
}

const ownedBy = (page: Page, userId: string, deviceId: string | null) =>
  page.addInitScript((entry) => localStorage.setItem(entry.key, entry.value), { key: OWNER_KEY, value: JSON.stringify({ user_id: userId, device_id: deviceId }) })
const storedOwner = (page: Page) => page.evaluate((key) => localStorage.getItem(key), OWNER_KEY)

test.describe('fixture: browser push', () => {
  test('without configuration push stays off and never asks for permission', async ({ page, api }) => {
    accountReads(api)
    await signIn(page, api, '/account')
    const devices = page.getByRole('region', { name: 'Push devices' })
    await expect(devices.getByText(/Push is not configured for this web client/)).toBeVisible()
    await expect(devices.getByRole('button', { name: /Turn on push/ })).toHaveCount(0)
  })

  test('permission is asked only from the Turn on click; a refusal registers nothing', async ({ page, api }) => {
    const providerCalls = await withPush(page)
    await page.addInitScript(() => {
      const counter = window as unknown as { __asked: number }
      counter.__asked = 0
      Notification.requestPermission = async () => {
        counter.__asked += 1
        return 'denied'
      }
    })
    accountReads(api)
    await signIn(page, api, '/account')
    const devices = page.getByRole('region', { name: 'Push devices' })
    const turnOn = devices.getByRole('button', { name: 'Turn on push for this browser' })
    await expect(turnOn).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(0)
    await turnOn.click()
    await expect(devices.getByRole('alert')).toContainText('Push was not turned on.')
    await expect(devices.getByRole('alert')).toContainText('Notifications are blocked for this site.')
    expect(await page.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(1)
    await expect(turnOn).toHaveCount(0)
    expect(await storedOwner(page)).toBeNull()
    expect(providerCalls).toEqual([])
  })

  for (const [name, script, text] of [
    ['blocked notifications', () => Object.defineProperty(Notification, 'permission', { get: () => 'denied' }), 'Notifications are blocked for this site.'],
    ['a browser without push', () => Reflect.deleteProperty(window, 'PushManager'), 'This browser cannot receive push notifications here.'],
  ] as const) {
    test(`${name} explains why push is unavailable`, async ({ page, api }) => {
      const providerCalls = await withPush(page)
      await page.addInitScript(script)
      accountReads(api)
      await signIn(page, api, '/account')
      const devices = page.getByRole('region', { name: 'Push devices' })
      await expect(devices.getByText(text)).toBeVisible()
      await expect(devices.getByRole('button', { name: /Turn on push/ })).toHaveCount(0)
      expect(providerCalls).toEqual([])
    })
  }

  test('this browser is marked, and turning push off removes its device', async ({ page, api }) => {
    const providerCalls = await withPush(page)
    await ownedBy(page, ME.user_id, DEVICE)
    let removed = false
    accountReads(api)
    api.set('GET /notification/v1/devices', (route) => json(route, 200, { items: removed ? [] : [webDevice], next_cursor: null }))
    api.set(`DELETE /notification/v1/devices/${DEVICE}`, (route) => {
      removed = true
      return route.fulfill({ status: 204 })
    })
    await signIn(page, api, '/account')
    const devices = page.getByRole('region', { name: 'Push devices' })
    await expect(devices.getByText('Web browser · This browser')).toBeVisible()
    await expect(devices.getByText('Push is on for this browser.')).toBeVisible()
    await devices.getByRole('button', { name: 'Turn off push' }).click()
    await expect(devices.getByRole('status')).toHaveText('Push is off for this browser.')
    await expect(devices.getByText('No devices are registered.')).toBeVisible()
    expect(removed).toBe(true)
    expect(await storedOwner(page)).toBeNull()
    expect(providerCalls).toEqual([])
  })

  test('signing out removes this browser’s device before ending the session', async ({ page, api }) => {
    await withPush(page)
    await ownedBy(page, ME.user_id, DEVICE)
    const order: string[] = []
    accountReads(api)
    api.set('GET /notification/v1/devices', (route) => json(route, 200, { items: [webDevice], next_cursor: null }))
    api.set(`DELETE /notification/v1/devices/${DEVICE}`, (route) => {
      order.push('device')
      return route.fulfill({ status: 204 })
    })
    api.set('POST /users/v1/auth/logout', (route) => {
      order.push('logout')
      return route.fulfill({ status: 204 })
    })
    await signIn(page, api, '/account')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByText('You are signed out.')).toBeVisible()
    expect(order).toEqual(['device', 'logout'])
    expect(await storedOwner(page)).toBeNull()
  })

  test('a subscription left by another player is released at sign-in', async ({ page, api }) => {
    await withPush(page)
    await ownedBy(page, OTHER_USER, DEVICE)
    accountReads(api)
    await signIn(page, api, '/account')
    await expect(page.getByRole('region', { name: 'Push devices' }).getByRole('button', { name: 'Turn on push for this browser' })).toBeVisible()
    await expect.poll(() => storedOwner(page)).toBeNull()
  })

  test('a notification click opens in-app paths only', async ({ page, api }) => {
    accountReads(api)
    await signIn(page, api, '/account')
    await expect(page.getByRole('heading', { name: ME.username })).toBeVisible()
    const open = (href: string) =>
      page.evaluate((target) => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'tamagotchi-go/push-open', href: target }, origin: location.origin })), href)
    await open('/credits')
    await expect(page).toHaveURL(/\/credits$/)
    await open('https://evil.example.test/')
    await expect(page).toHaveURL(/\/notifications$/)
  })
})
