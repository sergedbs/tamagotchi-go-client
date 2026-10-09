import { expect, test } from '@playwright/test'
import { goTo, registerPlayer } from './players.ts'
import { requireRealTarget } from './target.ts'

test.beforeAll(() => {
  requireRealTarget()
})

test('real: two nearby strangers see each other after sharing one-shot locations', async ({ browser }) => {
  test.setTimeout(90_000)
  // A random spot per run so earlier runs' observations are never within 6 m.
  const base = { latitude: 47 + Math.random() * 0.05, longitude: 28.8 + Math.random() * 0.05 }
  const a = await registerPlayer(browser, 'map-a', base)
  const b = await registerPlayer(browser, 'map-b', { latitude: base.latitude + 0.00002, longitude: base.longitude })

  for (const player of [a, b]) {
    await goTo(player.page, 'Explore')
    await expect(player.page.getByText('You have not shared a location yet.')).toBeVisible()
    await player.page.getByRole('button', { name: 'Share location' }).click()
    await expect(player.page.getByText('Share this location?')).toBeVisible()
    const write = player.page.waitForResponse((response) => response.url().endsWith('/api/map/v1/location') && response.request().method() === 'POST')
    await player.page.getByRole('button', { name: 'Share', exact: true }).click()
    expect((await write).status()).toBe(200)
    await expect(player.page.getByText(/^Shared .* expires /)).toBeVisible()
  }

  await b.page.getByRole('button', { name: 'Refresh nearby players' }).click()
  await expect(b.page.getByText('1 player nearby')).toBeVisible({ timeout: 15_000 })
  await b.page.getByRole('button', { name: 'List' }).click()
  const row = b.page.getByRole('list', { name: 'Nearby players' }).getByRole('button')
  await expect(row).toContainText(a.user.username)
  await expect(row).toContainText('Stranger')
  await row.click()
  await expect(b.page.getByRole('heading', { name: a.user.username })).toBeVisible()
  await expect(b.page.getByRole('link', { name: 'View profile' })).toBeVisible()
})
