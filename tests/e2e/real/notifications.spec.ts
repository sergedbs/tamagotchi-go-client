import { expect, test } from '@playwright/test'
import { openProfile, openUtility, registerPlayer } from './players.ts'
import { requireRealTarget } from './target.ts'

test.beforeAll(() => {
  requireRealTarget()
})

test('real: a friend request reaches the inbox; account shows wallets and saves preferences', async ({ browser }) => {
  test.setTimeout(120_000)
  const a = await registerPlayer(browser, 'inbox-a')
  const b = await registerPlayer(browser, 'inbox-b')

  await openProfile(a.page, b.userId)
  await a.page.getByRole('button', { name: 'Send friend request' }).click()
  await expect(a.page.getByText(/Friend request sent/)).toBeVisible()

  // The open inbox refreshes every 15 s; the event is produced asynchronously.
  await openUtility(b.page, 'Notifications')
  const card = b.page.getByRole('listitem').filter({ hasText: /wants to be friends|New friend request/ })
  await expect(card).toBeVisible({ timeout: 40_000 })
  test.info().annotations.push({ type: 'friend-request-card', description: (await card.innerText()).replace(/\s+/g, ' ') })
  await expect(card).toContainText(`${a.user.username} wants to be friends`)
  await expect(card.getByRole('link', { name: 'Review requests' })).toHaveAttribute('href', '/social')

  const bell = b.page.getByRole('navigation', { name: 'Utilities' }).getByRole('link', { name: /^Notifications/ })
  await expect(bell).toHaveAccessibleName(/unread/)
  await card.getByRole('button', { name: 'Mark read' }).click()
  await expect(card.getByRole('button', { name: 'Mark read' })).toHaveCount(0)
  await expect(bell).toHaveAccessibleName('Notifications')

  // Account: server wallets, a preference round trip with If-Match, no devices.
  await openUtility(b.page, 'Account')
  const coins = b.page.getByRole('region', { name: 'Wallets' }).getByRole('listitem').filter({ hasText: 'Coins' })
  await expect(coins).toContainText(/\d/)
  test.info().annotations.push({ type: 'wallets', description: (await b.page.getByRole('region', { name: 'Wallets' }).innerText()).replace(/\s+/g, ' ') })
  const preferences = b.page.getByRole('region', { name: 'Notification categories' })
  await preferences.getByLabel('Nearby players').uncheck()
  await preferences.getByRole('button', { name: 'Save preferences' }).click()
  await expect(preferences.getByText('Preferences saved.')).toBeVisible()
  await preferences.getByLabel('Nearby players').check()
  await preferences.getByRole('button', { name: 'Save preferences' }).click()
  await expect(preferences.getByText('Preferences saved.')).toBeVisible()
  await expect(preferences.getByLabel('Nearby players')).toBeChecked()
  await expect(b.page.getByRole('region', { name: 'Push devices' }).getByText('No devices are registered.')).toBeVisible()
})
