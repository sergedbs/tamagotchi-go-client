import { expect, json, test } from './network.ts'
import { CORRELATION, ME, problem, signIn, token } from './session.ts'

test.describe('fixture: diagnostics', () => {
  test('when enabled, records redacted attempts with codes and correlation IDs', async ({ page, api }) => {
    await page.route('**/client-config.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ diagnostics_enabled: true }) }))
    api.set(`GET /tamagotchi/v1/users/${ME.user_id}/collection`, (route) => json(route, 503, problem(503, 'service_unavailable')))
    await signIn(page, api)
    await expect(page.getByRole('heading', { name: 'Your creatures could not be loaded' })).toBeVisible()

    await page.getByRole('navigation', { name: 'Utilities' }).getByRole('link', { name: /^Account/ }).click()
    await page.getByRole('link', { name: 'Diagnostics' }).click()
    const table = page.getByRole('table', { name: 'Recent API attempts, newest first' })
    await expect(table.getByRole('row').filter({ hasText: '/users/v1/users/login' })).toContainText('200')
    const failed = table.getByRole('row').filter({ hasText: '/tamagotchi/v1/users/:id/collection' }).first()
    await expect(failed).toContainText('503 · service_unavailable')
    await expect(failed.locator(`code[title="${CORRELATION}"]`)).toContainText(CORRELATION.slice(-12))
    await expect(page.getByRole('status').filter({ hasText: /attempts failed/ })).toBeVisible()

    const text = await page.locator('main').innerText()
    for (const secret of [ME.email, ME.user_id, 'fixture password', token().split('.')[1]!]) expect(text).not.toContain(secret)

    await page.getByRole('button', { name: 'Clear' }).click()
    await expect(page.getByText('No requests recorded yet.')).toBeVisible()
  })

  test('when disabled, there is no diagnostics route or link', async ({ page, api }) => {
    api.set(`GET /tamagotchi/v1/users/${ME.user_id}/collection`, (route) => json(route, 200, { user_id: ME.user_id, primary: null, secondary: [], next_cursor: null, retrieved_at: '2026-10-09T10:00:00.000Z' }))
    await signIn(page, api, '/account')
    await expect(page.getByRole('link', { name: 'Credits and licenses' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Diagnostics' })).toHaveCount(0)
  })
})
