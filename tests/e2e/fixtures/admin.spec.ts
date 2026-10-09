import type { Request } from '@playwright/test'
import { expect, json, test, type ApiHandler } from './network.ts'
import { GROVE, ME, problem, signIn } from './session.ts'

const BOSS = '01a16000-0000-7000-8000-00000000e001'
const OCC = '01a16000-0000-7000-8000-00000000e101'
const ADMIN = ['user', 'admin']
const empty = { items: [], next_cursor: null }

const grovePackage = (overrides: Record<string, unknown> = {}) => ({
  package_id: GROVE,
  name: 'Grove Companions',
  description: '',
  version: '0.1.0',
  status: 'active',
  config_version: 1,
  developer_user_ids: [ME.user_id],
  moderator_user_ids: [ME.user_id],
  revision: 2,
  ...overrides,
})

const bossDefinition = {
  name: 'Cinder Gryfon',
  description: 'A hot-tempered sky hunter.',
  sprite_ref: 'lythbound/gryfon/spicy',
  combat_type: 'FLAME',
  max_hp: 5000,
  defense: 20,
  weaknesses: ['WATER'],
  resistances: [],
  special_properties: {},
  duration_seconds: 900,
  max_participants: 10,
  rewards: { global_currency: 50, xp: 120 },
  defeat_rewards: null,
}

function emptyCollection(api: Map<string, ApiHandler>) {
  api.set(`GET /tamagotchi/v1/users/${ME.user_id}/collection`, (route) => json(route, 200, { user_id: ME.user_id, primary: null, secondary: [], next_cursor: null, retrieved_at: '2026-10-09T10:00:00.000Z' }))
}

test.describe('fixture: administration', () => {
  test('the Admin entry is a hint from the role claim or moderation', async ({ page, api }) => {
    let moderator = '01a16000-0000-7000-8000-0000000000ff'
    emptyCollection(api)
    api.set('GET /registry/v1/packages', (route) => json(route, 200, { items: [grovePackage({ moderator_user_ids: [moderator] })], next_cursor: null }))
    const utilities = page.getByRole('navigation', { name: 'Utilities' })
    const listed = page.waitForResponse((response) => response.url().includes('/api/registry/v1/packages'))
    await signIn(page, api)
    await listed
    await expect(utilities.getByRole('link', { name: /^Account/ })).toBeVisible()
    await expect(utilities.getByRole('link', { name: 'Admin' })).toHaveCount(0)

    // Moderating a package shows the entry; a reload starts a new in-memory session.
    moderator = ME.user_id
    await signIn(page, api)
    await expect(utilities.getByRole('link', { name: 'Admin' })).toBeVisible()
  })

  test('package metadata saves with If-Match; a conflict loads the latest version for review', async ({ page, api }) => {
    const sent: Request[] = []
    let current = grovePackage()
    api.set(`GET /registry/v1/packages/${GROVE}`, (route) => json(route, 200, current, { etag: `"${current.revision}"` }))
    api.set(`PATCH /registry/v1/packages/${GROVE}`, (route) => {
      sent.push(route.request())
      if (sent.length === 1) {
        current = grovePackage({ description: 'Edited elsewhere', revision: 3 })
        return json(route, 412, problem(412, 'precondition_failed'))
      }
      current = { ...current, ...(route.request().postDataJSON() as object), revision: 4 }
      return json(route, 200, current, { etag: '"4"' })
    })
    await signIn(page, api, `/admin/packages/${GROVE}`, ADMIN)

    const metadata = page.getByRole('region', { name: 'Metadata' })
    await metadata.getByLabel('Version').fill('0.2.0')
    await metadata.getByRole('button', { name: 'Save metadata' }).click()
    await expect(metadata.getByText(/This changed since you loaded it/)).toBeVisible()
    await metadata.getByRole('button', { name: 'Load latest version' }).click()
    await expect(metadata.getByLabel('Description')).toHaveValue('Edited elsewhere')
    await expect(metadata.getByLabel('Version')).toHaveValue('0.1.0')
    await metadata.getByLabel('Version').fill('0.2.0')
    await metadata.getByRole('button', { name: 'Save metadata' }).click()
    await expect(metadata.getByText('Saved as revision 4.')).toBeVisible()

    expect(sent.map((request) => request.headers()['if-match'])).toEqual(['"2"', '"3"'])
    expect(sent[1]!.headers()['idempotency-key']).toBeTruthy()
    expect(sent[1]!.postDataJSON()).toEqual({ name: 'Grove Companions', description: 'Edited elsewhere', version: '0.2.0', status: 'active', developer_user_ids: [ME.user_id], moderator_user_ids: [ME.user_id] })
  })

  test('a configuration draft is checked, previewed and published as a full definition', async ({ page, api }) => {
    const bodies: Record<string, unknown>[] = []
    api.set(`GET /registry/v1/packages/${GROVE}`, (route) => json(route, 200, grovePackage(), { etag: '"2"' }))
    api.set(`PUT /registry/v1/packages/${GROVE}/stats`, (route) => {
      bodies.push(route.request().postDataJSON())
      return json(route, 200, { package_id: GROVE, config_version: 2, definition: (route.request().postDataJSON() as { definition: unknown }).definition })
    })
    await signIn(page, api, `/admin/packages/${GROVE}`, ADMIN)

    const config = page.getByRole('region', { name: 'Configuration' })
    await expect(config.getByRole('button', { name: 'Publish as v2' })).toBeDisabled()
    await config.getByLabel('Definition draft (JSON)').fill('{"stats": []}')
    await config.getByRole('button', { name: 'Check draft' }).click()
    await expect(config.getByText('The draft needs changes.')).toBeVisible()

    await config.getByLabel('Start from a bundled package').selectOption({ label: 'Grove Companions' })
    await config.getByRole('button', { name: 'Check draft' }).click()
    await expect(config.getByText(/Draft is valid: 3 stats, 3 care actions, starter Mossling/)).toBeVisible()
    await expect(config.getByRole('figure', { name: 'lythbound/wolfren/green' }).locator('img')).toHaveAttribute('src', 'http://localhost:5173/assets/creatures/lythbound/wolfren/green.png')
    await config.getByRole('button', { name: 'Publish as v2' }).click()
    await expect(config.getByText('Published configuration v2.')).toBeVisible()

    expect(bodies).toHaveLength(1)
    expect(bodies[0]!.expected_package_revision).toBe(2)
    const definition = bodies[0]!.definition as { assets: { url: string }[]; starter: { name: string } }
    expect(definition.starter.name).toBe('Mossling')
    expect(definition.assets[0]!.url).toBe('http://localhost:5173/assets/creatures/lythbound/wolfren/green.png')
    expect(JSON.stringify(bodies[0])).not.toContain('presentation')
  })

  test('a boss is validated, created and versioned with If-Match', async ({ page, api }) => {
    const writes: Request[] = []
    let version = 1
    let definition = bossDefinition
    api.set('GET /registry/v1/bosses', (route) => json(route, 200, empty))
    api.set('POST /registry/v1/bosses', (route) => {
      writes.push(route.request())
      definition = route.request().postDataJSON() as typeof bossDefinition
      return json(route, 201, { boss_id: BOSS, config_version: 1, definition })
    })
    api.set(`GET /registry/v1/bosses/${BOSS}`, (route) => json(route, 200, { boss_id: BOSS, config_version: version, definition }, { etag: `"${version}"` }))
    api.set(`PUT /registry/v1/bosses/${BOSS}`, (route) => {
      writes.push(route.request())
      version = 2
      definition = route.request().postDataJSON() as typeof bossDefinition
      return json(route, 200, { boss_id: BOSS, config_version: 2, definition }, { etag: '"2"' })
    })
    await signIn(page, api, '/admin/bosses', ADMIN)

    await page.getByRole('button', { name: 'Create a boss' }).click()
    const form = page.getByRole('region', { name: 'Create a boss' })
    await form.getByLabel('Max HP').fill('0')
    await form.getByRole('button', { name: 'Create boss' }).click()
    await expect(form.getByLabel('Name')).toHaveAttribute('aria-invalid', 'true')
    await expect(form.getByLabel('Max HP')).toHaveAttribute('aria-invalid', 'true')
    expect(writes).toHaveLength(0)

    await form.getByLabel('Name').fill('Ember Gryfon')
    await form.getByLabel('Max HP').fill('40')
    await form.getByRole('group', { name: 'Weak to' }).getByLabel('Water').check()
    await form.getByLabel('Pay something when time runs out').check()
    await form.getByLabel('Timeout XP').fill('10')
    await form.getByRole('button', { name: 'Create boss' }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Ember Gryfon' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Ember Gryfon' })).toHaveAttribute('src', '/assets/creatures/lythbound/gryfon/spicy.png')
    await page.getByLabel('Duration (seconds)').fill('300')
    await page.getByRole('button', { name: 'Save as version 2' }).click()
    await expect(page.getByText('Saved as version 2.')).toBeVisible()

    expect(writes[0]!.postDataJSON()).toMatchObject({ name: 'Ember Gryfon', max_hp: 40, weaknesses: ['WATER'], special_properties: {}, defeat_rewards: { xp: 10, global_currency: 0 } })
    expect(writes[0]!.headers()['idempotency-key']).toBeTruthy()
    expect(writes[1]!.headers()['if-match']).toBe('"1"')
    expect(writes[1]!.headers()['idempotency-key']).toBeTruthy()
    expect(writes[1]!.postDataJSON()).toMatchObject({ name: 'Ember Gryfon', duration_seconds: 300 })
  })

  test('a non-admin sees the server refusal on boss administration', async ({ page, api }) => {
    emptyCollection(api)
    api.set('GET /registry/v1/bosses', (route) => json(route, 403, problem(403, 'admin_required')))
    await signIn(page, api, '/admin/bosses')
    await expect(page.getByRole('heading', { name: 'Boss administration needs the admin role' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
  })

  test('occurrences are scheduled in UTC, activated with a key and cancelled after confirmation', async ({ page, api }) => {
    const writes: Request[] = []
    let occurrence: Record<string, unknown> | null = null
    api.set('GET /registry/v1/bosses', (route) => json(route, 200, { items: [{ boss_id: BOSS, config_version: 2, definition: bossDefinition }], next_cursor: null }))
    api.set('GET /registry/v1/raid-occurrences', (route) => json(route, 200, { items: occurrence ? [occurrence] : [], next_cursor: null }))
    api.set('POST /registry/v1/raid-occurrences', (route) => {
      writes.push(route.request())
      occurrence = { occurrence_id: OCC, ...(route.request().postDataJSON() as object), status: 'scheduled', version: 1 }
      return json(route, 201, occurrence)
    })
    for (const action of ['activate', 'cancel'] as const) {
      api.set(`POST /registry/v1/raid-occurrences/${OCC}/${action}`, (route) => {
        writes.push(route.request())
        occurrence = { ...occurrence!, status: action === 'activate' ? 'active' : 'cancelled', version: 2 }
        return json(route, 200, { occurrence, runtime_propagation: 'PENDING' })
      })
    }
    await signIn(page, api, '/admin/occurrences', ADMIN)

    await page.getByRole('button', { name: 'Schedule an occurrence' }).click()
    const form = page.getByRole('region', { name: 'Schedule an occurrence' })
    await form.getByLabel('Boss', { exact: true }).selectOption({ label: 'Cinder Gryfon (v2)' })
    await form.getByLabel('Opens').fill('2026-10-10T10:00')
    await form.getByLabel('Closes').fill('2026-10-10T09:00')
    await form.getByRole('button', { name: 'Schedule occurrence' }).click()
    await expect(form.getByText('The window must end after it starts.')).toBeVisible()
    await form.getByLabel('Closes').fill('2026-10-10T11:00')
    await form.getByRole('button', { name: 'Schedule occurrence' }).click()

    const row = page.getByRole('row', { name: /Cinder Gryfon/ })
    await expect(row.getByText('scheduled')).toBeVisible()
    await row.getByRole('button', { name: 'Activate' }).click()
    await expect(row.getByText('active', { exact: true })).toBeVisible()
    await row.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel occurrence' }).click()
    await expect(row.getByText('cancelled')).toBeVisible()
    await expect(row.getByRole('button')).toHaveCount(0)

    const created = writes[0]!.postDataJSON() as { boss_id: string; boss_version: number; available_from: string; available_until: string }
    expect(created.boss_id).toBe(BOSS)
    expect(created.boss_version).toBe(2)
    expect(created.available_from).toBe(new Date('2026-10-10T10:00').toISOString())
    expect(Date.parse(created.available_until) - Date.parse(created.available_from)).toBe(3_600_000)
    expect(writes.slice(1).map((request) => [new URL(request.url()).pathname.split('/').pop(), !!request.headers()['idempotency-key']])).toEqual([
      ['activate', true],
      ['cancel', true],
    ])
  })
})
