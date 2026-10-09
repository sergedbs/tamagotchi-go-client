import type { Request } from '@playwright/test'
import { expect, json, test } from './network.ts'
import { assetsFor, creature, GROVE, ME, problem, signIn, withGroveConfig } from './session.ts'

const MOSS = '01a11f00-0000-7000-8000-00000000c001'
const RIPPLE = '01a11f00-0000-7000-8000-00000000c002'
const collectionPath = `GET /tamagotchi/v1/users/${ME.user_id}/collection`
const assetsPath = `GET /registry/v1/packages/${GROVE}/assets`

function collection(primary: unknown, secondary: unknown[] = []) {
  return { user_id: ME.user_id, primary, secondary, next_cursor: null, retrieved_at: '2026-10-09T10:00:00.000Z' }
}

test.describe('fixture: creature home with server data', () => {
  test.beforeEach(async ({ page }) => {
    await withGroveConfig(page)
  })

  test('care sends the declared action once and shows the authoritative result', async ({ page, api }) => {
    const sent: Request[] = []
    api.set(collectionPath, (route) => json(route, 200, collection(creature(MOSS), [creature(RIPPLE, { name: 'Ripple', role: 'SECONDARY', combat_type: 'WATER' })])))
    api.set(assetsPath, assetsFor)
    api.set(`POST /tamagotchi/v1/tamagotchis/${MOSS}/care`, (route) => {
      sent.push(route.request())
      return json(route, 200, { care_action_id: '01a11f00-0000-7000-8000-0000000000aa', currency_status: 'PENDING', tamagotchi: creature(MOSS, { xp: 42, version: 4, package_stats: { energy: 60, bond: 30, temperament: 'curious' } }) })
    })
    await signIn(page, api)
    await expect(page.getByRole('heading', { level: 1, name: 'Mossling' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Mossling' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Ripple/ })).toHaveAttribute('href', `/creatures/${RIPPLE}`)

    await page.getByRole('button', { name: /Feed/ }).click()
    const status = page.getByRole('status').filter({ hasText: 'Feed recorded' })
    await expect(status).toContainText('XP 40 → 42')
    await expect(status).toContainText('Energy 50 → 60')
    await expect(status).toContainText('Currency reward pending')
    await expect(page.getByText('42 XP')).toBeVisible()
    expect(sent).toHaveLength(1)
    expect(sent[0]?.postDataJSON()).toEqual({ action: 'FEED' })
    expect(sent[0]?.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{14}7/)
  })

  test('cooldown is explained without inventing a duration', async ({ page, api }) => {
    api.set(collectionPath, (route) => json(route, 200, collection(creature(MOSS))))
    api.set(assetsPath, assetsFor)
    api.set(`POST /tamagotchi/v1/tamagotchis/${MOSS}/care`, (route) => json(route, 409, problem(409, 'action_on_cooldown')))
    await signIn(page, api)
    await page.getByRole('button', { name: /Play/ }).click()
    await expect(page.getByRole('status')).toContainText('Play is cooling down. Try again shortly.')
  })

  test('an uncertain care result is replayed only on request, with the same key', async ({ page, api }) => {
    const sent: Request[] = []
    api.set(collectionPath, (route) => json(route, 200, collection(creature(MOSS))))
    api.set(assetsPath, assetsFor)
    api.set(`POST /tamagotchi/v1/tamagotchis/${MOSS}/care`, (route) => {
      sent.push(route.request())
      if (sent.length === 1) return json(route, 504, problem(504, 'task_timeout'))
      return json(route, 200, { care_action_id: '01a11f00-0000-7000-8000-0000000000aa', currency_status: 'PENDING', tamagotchi: creature(MOSS, { xp: 43, version: 4 }) })
    })
    await signIn(page, api)
    await page.getByRole('button', { name: /Rest/ }).click()
    await expect(page.getByRole('status')).toContainText('may or may not have been applied')
    await expect(page.getByText('01a11e47-c352-7320-9957-baa3f0722d52')).toBeVisible()
    await page.waitForTimeout(300)
    expect(sent).toHaveLength(1)
    await page.getByRole('button', { name: 'Retry same request' }).click()
    await expect(page.getByRole('status')).toContainText('Rest recorded')
    expect(sent[1]?.headers()['idempotency-key']).toBe(sent[0]?.headers()['idempotency-key'])
    expect(sent[1]?.postData()).toBe(sent[0]?.postData())
  })

  test('waits for a server-created starter with bounded polling', async ({ page, api }) => {
    let reads = 0
    api.set(collectionPath, (route) => {
      reads += 1
      return json(route, 200, reads < 3 ? collection(null) : collection(creature(MOSS)))
    })
    api.set(assetsPath, assetsFor)
    await signIn(page, api)
    await expect(page.getByRole('heading', { name: 'Your starter is on its way' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Mossling' })).toBeVisible({ timeout: 10_000 })
    expect(reads).toBeGreaterThanOrEqual(3)
  })

  test('unknown package versions show facts and keep care off', async ({ page, api }) => {
    api.set(collectionPath, (route) => json(route, 200, collection(creature(MOSS, { config_version: 9, package_stats: { hunger: 80 } }))))
    api.set(`GET /registry/v1/packages/${GROVE}/assets`, (route) => json(route, 200, { package_id: GROVE, config_version: 9, items: [{ sprite_ref: 'x', url: 'https://example.com/x.png' }] }))
    await signIn(page, api)
    await expect(page.getByText(/care actions stay off/)).toBeVisible()
    await expect(page.getByText('hunger')).toBeVisible()
    await expect(page.getByRole('img', { name: 'Mossling: artwork unavailable' })).toBeVisible()
  })

  test('collection failures keep a retry and the correlation reference', async ({ page, api }) => {
    let calls = 0
    api.set(collectionPath, (route) => {
      calls += 1
      return calls === 1 ? json(route, 502, problem(502, 'dependency_error')) : json(route, 200, collection(creature(MOSS)))
    })
    api.set(assetsPath, assetsFor)
    await signIn(page, api)
    await expect(page.getByRole('alert')).toContainText('A Tamagotchi Go service is unavailable right now.')
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Mossling' })).toBeVisible()
  })
})

test.describe('fixture: creature detail', () => {
  test.beforeEach(async ({ page }) => {
    await withGroveConfig(page)
  })

  test('primary change uses the primary-selection ETag and recovers from 412', async ({ page, api }) => {
    const puts: Request[] = []
    const ripple = creature(RIPPLE, { name: 'Ripple', role: 'SECONDARY', combat_type: 'WATER' })
    api.set(collectionPath, (route) => json(route, 200, collection(creature(MOSS), [ripple])))
    api.set(assetsPath, assetsFor)
    api.set(`GET /tamagotchi/v1/tamagotchis/${RIPPLE}`, (route) => json(route, 200, ripple, { etag: '"3"' }))
    api.set(`GET /tamagotchi/v1/tamagotchis/${RIPPLE}/holders`, (route) => json(route, 200, { tamagotchi_id: RIPPLE, origin_owner_id: ME.user_id, holder_user_ids: [ME.user_id], holder_cap: 5, version: 1 }, { etag: '"1"' }))
    let selectionVersion = 4
    api.set(`GET /tamagotchi/v1/users/${ME.user_id}/collection/primary`, (route) =>
      json(route, 200, { user_id: ME.user_id, tamagotchi_id: MOSS, version: selectionVersion }, { etag: `"${selectionVersion}"` }),
    )
    api.set(`PUT /tamagotchi/v1/users/${ME.user_id}/collection/primary`, (route) => {
      puts.push(route.request())
      if (puts.length === 1) {
        selectionVersion = 5
        return json(route, 412, problem(412, 'precondition_failed'))
      }
      return json(route, 200, { user_id: ME.user_id, tamagotchi_id: RIPPLE, version: 6 }, { etag: '"6"' })
    })
    await signIn(page, api, `/creatures/${RIPPLE}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Ripple' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Release' })).toBeDisabled()
    await expect(page.getByText('You are the origin owner and the only holder')).toBeVisible()
    await page.getByRole('button', { name: 'Make primary' }).click()
    const dialog = page.getByRole('dialog', { name: 'Make Ripple your primary?' })
    await dialog.getByRole('button', { name: 'Make primary' }).click()
    await expect(dialog.getByRole('alert')).toContainText('The latest version has been reloaded')
    await expect(dialog.getByRole('button', { name: 'Make primary' })).toBeEnabled()
    await dialog.getByRole('button', { name: 'Make primary' }).click()
    await expect(dialog).toBeHidden()
    expect(puts.map((request) => request.headers()['if-match'])).toEqual(['"4"', '"5"'])
    expect(puts[0]?.postDataJSON()).toEqual({ tamagotchi_id: RIPPLE })
  })

  test('release uses the creature ETag; sole origin owners cannot release', async ({ page, api }) => {
    const deletes: Request[] = []
    const ripple = creature(RIPPLE, { name: 'Ripple', role: 'SECONDARY', origin_owner_id: '01a11e00-0000-7000-8000-000000000099', holder_user_ids: ['01a11e00-0000-7000-8000-000000000099', ME.user_id] })
    api.set(collectionPath, (route) => json(route, 200, collection(creature(MOSS), [ripple])))
    api.set(assetsPath, assetsFor)
    api.set(`GET /tamagotchi/v1/tamagotchis/${RIPPLE}`, (route) => json(route, 200, ripple, { etag: '"7"' }))
    api.set(`GET /tamagotchi/v1/tamagotchis/${RIPPLE}/holders`, (route) =>
      json(route, 200, { tamagotchi_id: RIPPLE, origin_owner_id: '01a11e00-0000-7000-8000-000000000099', holder_user_ids: ripple.holder_user_ids, holder_cap: 5, version: 2 }, { etag: '"2"' }),
    )
    api.set('GET /users/v1/users/01a11e00-0000-7000-8000-000000000099', (route) => json(route, 200, { user_id: '01a11e00-0000-7000-8000-000000000099', username: 'leon' }))
    api.set(`DELETE /tamagotchi/v1/users/${ME.user_id}/collection/${RIPPLE}`, (route) => {
      deletes.push(route.request())
      return route.fulfill({ status: 204 })
    })
    await signIn(page, api, `/creatures/${RIPPLE}`)
    await expect(page.getByText('Shared by 2 holders')).toBeVisible()
    await expect(page.getByRole('link', { name: 'leon' })).toBeVisible()
    await expect(page.getByText('Origin owner', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Release' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Release' }).click()
    await expect(page).toHaveURL(/\/creatures$/)
    expect(deletes[0]?.headers()['if-match']).toBe('"7"')
  })
})
