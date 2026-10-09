import type { Page, Request } from '@playwright/test'
import { expect, json, test } from './network.ts'
import { ME, problem, signIn } from './session.ts'

const locationPath = `GET /map/v1/location/${ME.user_id}`
const nearbyPath = `GET /map/v1/location/nearby/${ME.user_id}`
const later = () => new Date(Date.now() + 5 * 60_000).toISOString()

function own(expiresAt = later()) {
  return { user_id: ME.user_id, lat: 47.0105, lng: 28.8638, timestamp: new Date(Date.now() - 30_000).toISOString(), accuracy_m: 5, expires_at: expiresAt }
}

function marker(index: number, relationship = 'stranger') {
  return { user_id: `01a12000-0000-7000-8000-${String(index).padStart(12, '0')}`, lat: 47.0105 + index * 0.00001, lng: 28.8638, timestamp: new Date().toISOString(), distance_m: index, relationship }
}

function nearbyPage(markers: unknown[], next: string | null = null, partial = false) {
  return { user_id: ME.user_id, nearby: markers, retrieved_at: new Date().toISOString(), next_cursor: next, partial, partial_reason: partial ? 'RELATIONSHIPS_UNAVAILABLE' : null }
}

/** Identified provider fixture: a blank style so no tiles are fetched. */
async function blankMap(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e8eddf' } }] }) }),
  )
}

async function openExplore(page: Page) {
  await page.getByRole('navigation', { name: 'Main' }).filter({ visible: true }).getByRole('link', { name: 'Explore' }).click()
}

test.describe('fixture: explore', () => {
  test.beforeEach(async ({ api }) => {
    api.set(`GET /tamagotchi/v1/users/${ME.user_id}/collection`, (route) => json(route, 200, { user_id: ME.user_id, primary: null, secondary: [], next_cursor: null, retrieved_at: new Date().toISOString() }))
  })

  test('aggregates 101 markers across pages with the same limit', async ({ page, api }) => {
    await blankMap(page)
    const urls: string[] = []
    api.set(locationPath, (route) => json(route, 200, own()))
    api.set(nearbyPath, (route, url) => {
      urls.push(url.search)
      return url.searchParams.get('cursor') ? json(route, 200, nearbyPage([marker(100, 'friend')])) : json(route, 200, nearbyPage(Array.from({ length: 100 }, (_, index) => marker(index)), 'next-1'))
    })
    await signIn(page, api)
    await openExplore(page)
    await expect(page.getByText('101 players nearby')).toBeVisible()
    expect(urls).toEqual(['?limit=100', '?limit=100&cursor=next-1'])
    await expect(page.locator('button[data-relationship]')).toHaveCount(101)
  })

  test('provider failure keeps a usable list, with attribution-free fallback text', async ({ page, api }) => {
    await page.route('https://tiles.openfreemap.org/**', (route) => route.abort())
    api.set(locationPath, (route) => json(route, 200, own()))
    api.set(nearbyPath, (route) => json(route, 200, nearbyPage([marker(3, 'enemy')])))
    api.set('GET /users/v1/users/01a12000-0000-7000-8000-000000000003', (route) => json(route, 200, { user_id: '01a12000-0000-7000-8000-000000000003', username: 'leon' }))
    await signIn(page, api)
    await openExplore(page)
    await expect(page.getByText('Map tiles could not be loaded from the map provider.')).toBeVisible({ timeout: 15_000 })
    const row = page.getByRole('list', { name: 'Nearby players' }).getByRole('button')
    await expect(row).toContainText('leon')
    await expect(row).toContainText('Enemy')
    await row.click()
    await expect(page.getByRole('heading', { name: 'leon' })).toBeVisible()
  })

  test('partial results warn that only close strangers are shown', async ({ page, api }) => {
    await blankMap(page)
    api.set(locationPath, (route) => json(route, 200, own()))
    api.set(nearbyPath, (route) => json(route, 200, nearbyPage([marker(2)], null, true)))
    await signIn(page, api)
    await openExplore(page)
    await expect(page.getByText('Only close strangers are shown.')).toBeVisible()
  })

  test('an expired own location never shows stale pins', async ({ page, api }) => {
    await blankMap(page)
    let nearbyCalls = 0
    api.set(locationPath, (route) => json(route, 200, own(new Date(Date.now() - 60_000).toISOString())))
    api.set(nearbyPath, (route) => {
      nearbyCalls += 1
      return json(route, 200, nearbyPage([marker(1)]))
    })
    await signIn(page, api)
    await openExplore(page)
    await expect(page.getByText(/Your shared location expired/)).toBeVisible()
    await expect(page.getByText('Update your location to see nearby players.')).toBeVisible()
    await expect(page.locator('button[data-relationship]')).toHaveCount(0)
    expect(nearbyCalls).toBe(0)
  })

  test('missing viewer location is a prompt, not an empty map', async ({ page, api }) => {
    await blankMap(page)
    api.set(locationPath, (route) => json(route, 200, own()))
    api.set(nearbyPath, (route) => json(route, 409, problem(409, 'viewer_location_unavailable')))
    await signIn(page, api)
    await openExplore(page)
    await expect(page.getByText('The map has no fresh location for you.')).toBeVisible()
  })

  test.describe('with browser location permission', () => {
    test.use({ geolocation: { latitude: 47.02, longitude: 28.83, accuracy: 12 }, permissions: ['geolocation'] })

    test('previews before sharing and reports a receipt that was not accepted', async ({ page, api }) => {
      await blankMap(page)
      const writes: Request[] = []
      api.set(locationPath, (route) => json(route, 404, problem(404, 'not_found')))
      api.set('POST /map/v1/location', (route) => {
        writes.push(route.request())
        // Live Map semantics: STALE is a reading older than about a minute; nothing is stored.
        return json(route, 200, { ok: true, accepted: false, reason: 'STALE', current_timestamp: null, expires_at: null })
      })
      await signIn(page, api)
      await openExplore(page)
      await expect(page.getByText('Default view — not your location')).toBeVisible()
      await page.getByRole('button', { name: 'Share location' }).click()
      await expect(page.getByText('Share this location?')).toBeVisible()
      await expect(page.getByText('47.02000, 28.83000')).toBeVisible()
      expect(writes).toHaveLength(0)
      const clicked = Date.now()
      await page.getByRole('button', { name: 'Share', exact: true }).click()
      await expect(page.getByText(/That reading was too old for the map/)).toBeVisible()
      const body = writes[0]?.postDataJSON()
      expect(body).toMatchObject({ user_id: ME.user_id, lat: 47.02, lng: 28.83, accuracy_m: 12 })
      expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      // Stamped when shared, not with the device's (possibly cached) fix time.
      expect(Math.abs(Date.parse(body.timestamp) - clicked)).toBeLessThan(5_000)
      expect(writes[0]?.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{14}7/)
    })

    test('an old preview is located again instead of being sent', async ({ page, api }) => {
      await page.clock.install()
      await blankMap(page)
      const writes: Request[] = []
      api.set(locationPath, (route) => json(route, 404, problem(404, 'not_found')))
      api.set('POST /map/v1/location', (route) => {
        writes.push(route.request())
        return json(route, 400, problem(400, 'invalid_timestamp'))
      })
      await signIn(page, api)
      await openExplore(page)
      await page.getByRole('button', { name: 'Share location' }).click()
      await expect(page.getByText('Share this location?')).toBeVisible()
      await page.clock.fastForward(31_000)
      await page.getByRole('button', { name: 'Share', exact: true }).click()
      await expect(page.getByText('That reading is more than 30 seconds old. Locate again to share where you are now.')).toBeVisible()
      expect(writes).toHaveLength(0)

      // A fresh reading is sent; a refused timestamp points at the device clock.
      await page.getByRole('button', { name: 'Share location' }).click()
      await page.getByRole('button', { name: 'Share', exact: true }).click()
      await expect(page.getByText(/Check that your device clock is set automatically/)).toBeVisible()
      expect(writes).toHaveLength(1)
    })
  })

  test.describe('without browser location permission', () => {
    test.use({ permissions: [] })

    test('a denied permission is explained without breaking the screen', async ({ page, api, context }) => {
      await blankMap(page)
      await context.clearPermissions()
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'geolocation', {
          value: { getCurrentPosition: (_ok: unknown, fail: (error: { code: number; PERMISSION_DENIED: number; TIMEOUT: number }) => void) => fail({ code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3 }) },
        })
      })
      api.set(locationPath, (route) => json(route, 404, problem(404, 'not_found')))
      await signIn(page, api)
      await openExplore(page)
      await page.getByRole('button', { name: 'Share location' }).click()
      await expect(page.getByText(/Location permission is blocked/)).toBeVisible()
    })
  })
})
