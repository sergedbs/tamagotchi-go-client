import { expect, json, test } from './network.ts'
import { assetsFor, creature, GROVE, ME, signIn } from './session.ts'

const TIDE = '01a11d09-0000-7000-8000-00000000a002'
const MOSS = '01a11f00-0000-7000-8000-00000000c001'
const RIPPLE = '01a11f00-0000-7000-8000-00000000c002'

const pkg = (package_id: string, name: string) => ({ package_id, name, description: '', version: '0.1.0', status: 'active', config_version: 1, developer_user_ids: [], moderator_user_ids: [], revision: 2 })

test.describe('fixture: account', () => {
  test('joining a package waits for its server-created starter', async ({ page, api }) => {
    let joined = false
    let reads = 0
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
    api.set('GET /registry/v1/packages', (route) => json(route, 200, { items: [pkg(GROVE, 'Grove Companions'), pkg(TIDE, 'Tidewater Companions')], next_cursor: null }))
    await signIn(page, api, '/account')

    await page.getByLabel('Join another package').selectOption({ label: 'Tidewater Companions (v0.1.0)' })
    await page.getByRole('button', { name: 'Join package' }).click()
    await expect(page.getByText('Its starter creature is being created by the server…')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ripple' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('region', { name: 'Packages' }).getByRole('listitem')).toHaveText(['Grove Companions', 'Tidewater Companions'])
  })
})
