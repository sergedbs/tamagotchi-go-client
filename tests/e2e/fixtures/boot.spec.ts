import { expect, test } from './network.ts'

test.describe('fixture: application boot', () => {
  test('redirects home to creatures', async ({ page, api }) => {
    void api
    await page.goto('/')
    await expect(page).toHaveURL(/\/creatures$/)
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
