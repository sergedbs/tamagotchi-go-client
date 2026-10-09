import type { Request } from '@playwright/test'
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
