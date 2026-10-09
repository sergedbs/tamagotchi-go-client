import type { Request } from '@playwright/test'
import { expect, json, test } from './network.ts'
import { ME, problem, signIn } from './session.ts'

const ID = (n: number) => `01a14000-0000-7000-8000-${String(n).padStart(12, '0')}`
const LEON = '01a12000-0000-7000-8000-00000000b001'
const inboxPath = `GET /notification/v1/users/${ME.user_id}/notifications`
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()

function notification(n: number, type: string, params: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return { id: ID(n), user_id: ME.user_id, type, event_id: ID(100 + n), params, created_at: at(-n * 60_000), read_at: null, delivery_status: 'NO_DEVICE', ...overrides }
}

const SEVEN = [
  notification(1, 'FRIEND_REQUEST', { request_id: ID(201), from_user_id: LEON, from_username: 'leon', expires_at: at(3_600_000) }),
  notification(2, 'PLAYER_NEARBY', { with_user_id: LEON, distance_m: 85, encounter_id: ID(202) }),
  notification(3, 'BATTLE_REQUEST', { battle_id: ID(203), challenger_id: LEON, challenger_username: 'leon', expires_at: at(3_600_000) }, { delivery_status: 'ACCEPTED_BY_PROVIDER' }),
  notification(4, 'TAMAGOTCHI_SHARED', { tamagotchi_id: ID(204), tamagotchi_name: 'Ripple', combat_type: 'WATER', level: 3 }),
  notification(5, 'GUILD_INVITATION', { guild_id: ID(205), guild_name: 'Moss Hollow', invitation_id: ID(206), expires_at: at(3_600_000) }),
  notification(6, 'RAID_STARTED', { raid_id: 'not-a-uuid', guild_id: ID(205), boss_name: 'Cinder Gryfon', started_at: at(0), expires_at: at(600_000) }, { read_at: at(-1000) }),
  notification(7, 'SEASON_STARTED', { season: 4 }, { delivery_status: 'FAILED' }),
]

test.describe('fixture: notifications inbox', () => {
  test('renders the six templates and a neutral fallback with validated links', async ({ page, api }) => {
    api.set(inboxPath, (route) => json(route, 200, { items: SEVEN, next_cursor: null }))
    await signIn(page, api, '/notifications')

    const list = page.getByRole('list', { name: 'Notifications, 6 unread' })
    await expect(list.getByRole('listitem')).toHaveCount(7)
    await expect(list.getByText('leon wants to be friends')).toBeVisible()
    await expect(list.getByRole('link', { name: 'View player' })).toHaveAttribute('href', `/players/${LEON}`)
    await expect(list.getByRole('link', { name: 'Open battle' })).toHaveAttribute('href', `/combat/battles/${ID(203)}`)
    await expect(list.getByText('Handed to the push provider')).toBeVisible()
    await expect(list.getByText('Level 3 · Water')).toBeVisible()
    await expect(list.getByRole('link', { name: 'Open guild' })).toHaveAttribute('href', `/guilds/${ID(205)}`)
    // An invalid raid ID falls back to the raid list instead of a forged route.
    await expect(list.getByRole('link', { name: 'Open raids' })).toHaveAttribute('href', '/combat/raids')
    await expect(list.getByText('New notification')).toBeVisible()
    await expect(list.getByText('Push failed')).toBeVisible()
    await expect(page.getByText('season')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Utilities' }).getByRole('link', { name: 'Notifications, 6 unread' })).toBeVisible()
  })

  test('marking one read updates the item and the bell', async ({ page, api }) => {
    const bodies: unknown[] = []
    const first = SEVEN[0]!
    api.set(inboxPath, (route) => json(route, 200, { items: [first, SEVEN[1]], next_cursor: null }))
    api.set(`PATCH /notification/v1/notifications/${first.id}`, (route) => {
      bodies.push(route.request().postDataJSON())
      return json(route, 200, { ...first, read_at: at(0) })
    })
    await signIn(page, api, '/notifications')
    const bell = page.getByRole('navigation', { name: 'Utilities' }).getByRole('link', { name: /^Notifications/ })
    await expect(bell).toHaveAccessibleName('Notifications, 2 unread')
    await page.getByRole('listitem').filter({ hasText: 'leon wants to be friends' }).getByRole('button', { name: 'Mark read' }).click()
    await expect(page.getByRole('list', { name: 'Notifications, 1 unread' })).toBeVisible()
    await expect(bell).toHaveAccessibleName('Notifications, 1 unread')
    expect(bodies).toEqual([{ read: true }])
  })

  test('read-all fixes created_before and an uncertain reply is retried with the same command', async ({ page, api }) => {
    const sent: Request[] = []
    let read = false
    api.set(inboxPath, (route) => json(route, 200, { items: SEVEN.slice(0, 2).map((item) => (read ? { ...item, read_at: at(0) } : item)), next_cursor: null }))
    api.set(`POST /notification/v1/users/${ME.user_id}/notifications/read-all`, (route) => {
      sent.push(route.request())
      if (sent.length === 1) return json(route, 504, problem(504, 'upstream_timeout'))
      read = true
      return json(route, 200, { updated_count: 2 })
    })
    await signIn(page, api, '/notifications')
    await page.getByRole('button', { name: 'Mark all as read' }).click()
    await expect(page.getByText('We could not confirm the inbox was updated.')).toBeVisible()
    await page.getByRole('button', { name: 'Retry same request' }).click()
    await expect(page.getByText('2 notifications were marked as read.')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Notifications' })).toBeVisible()

    expect(sent).toHaveLength(2)
    const [a, b] = sent.map((request) => ({ body: request.postDataJSON() as { created_before: string }, key: request.headers()['idempotency-key'] }))
    expect(a!.body).toEqual(b!.body)
    expect(a!.key).toBe(b!.key)
    expect(Date.parse(a!.body.created_before)).not.toBeNaN()
  })

  test('the open inbox refreshes every 15 seconds', async ({ page, api }) => {
    await page.clock.install()
    let reads = 0
    api.set(inboxPath, (route) => {
      reads += 1
      return json(route, 200, { items: reads > 1 ? [SEVEN[0]] : [], next_cursor: null })
    })
    await signIn(page, api, '/notifications')
    await expect(page.getByText(/Nothing here yet/)).toBeVisible()
    await page.clock.runFor(15_500)
    await expect(page.getByText('leon wants to be friends')).toBeVisible()
  })

  test('an inbox failure is explained with a retry', async ({ page, api }) => {
    let fail = true
    api.set(inboxPath, (route) => (fail ? json(route, 503, problem(503, 'service_unavailable')) : json(route, 200, { items: [], next_cursor: null })))
    await signIn(page, api, '/notifications')
    await expect(page.getByRole('heading', { name: 'Notifications could not be loaded' })).toBeVisible()
    fail = false
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByText(/Nothing here yet/)).toBeVisible()
  })
})
