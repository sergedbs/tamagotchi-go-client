import { expect, json, test } from './network.ts'

test.describe('fixture: application boot', () => {
  test('signed-out visitors are sent to sign in, keeping the destination', async ({ page, api }) => {
    api.set('GET /registry/v1/packages', (route) => json(route, 200, { items: [], next_cursor: null }))
    await page.goto('/creatures')
    await expect(page).toHaveURL(/\/login\?next=%2Fcreatures$/)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  })

  test('explains invalid runtime configuration instead of starting', async ({ page, api }) => {
    void api
    await page.route('**/client-config.json', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ api_base: 'https://elsewhere.example.test' }) }),
    )
    await page.goto('/creatures')
    await expect(page.getByRole('heading', { name: 'Tamagotchi Go cannot start' })).toBeVisible()
    await expect(page.getByText(/api_base/)).toBeVisible()
  })

  test('unknown routes show a not-found screen', async ({ page, api }) => {
    void api
    await page.goto('/no-such-screen')
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  })
})
