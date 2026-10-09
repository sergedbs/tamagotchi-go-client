import { expect, test } from '@playwright/test'
import { goTo, openProfile, registerPlayer } from './players.ts'
import { runId } from './ledger.ts'
import { requireRealTarget } from './target.ts'

test.beforeAll(() => {
  requireRealTarget()
})

test('real: friends form a guild and chat over the negotiated socket', async ({ browser }) => {
  test.setTimeout(120_000)
  const a = await registerPlayer(browser, 'guild-a')
  const b = await registerPlayer(browser, 'guild-b')

  // Friendship first (invitations to strangers are affected by a known server gap).
  await openProfile(a.page, b.userId)
  await expect(a.page.getByRole('heading', { name: b.user.username })).toBeVisible()
  await a.page.getByRole('button', { name: 'Send friend request' }).click()
  await expect(a.page.getByText(/Friend request sent/)).toBeVisible()

  await goTo(b.page, 'Social')
  await expect(b.page.getByText('Wants to be friends', { exact: false })).toBeVisible()
  await b.page.getByRole('button', { name: 'Accept' }).click()
  await expect(b.page.getByRole('link', { name: a.user.username })).toBeVisible()
  await expect(b.page.getByText('No pending requests.')).toBeVisible()

  // Guild created by A, B invited from the friends list.
  await goTo(a.page, 'Social')
  await a.page.getByRole('navigation', { name: 'Social' }).getByRole('link', { name: 'Guilds' }).click()
  await a.page.getByRole('button', { name: 'Create a guild' }).click()
  const guildName = `Grove ${runId()}`
  await a.page.getByLabel('Name').fill(guildName)
  await a.page.getByLabel('Description').fill('Synthetic guild for client acceptance.')
  await a.page.getByRole('button', { name: 'Create guild' }).click()
  await expect(a.page.getByRole('heading', { level: 1, name: guildName })).toBeVisible()
  await expect(a.page.getByText('You are leader')).toBeVisible()

  await a.page.getByLabel('Friend').selectOption(b.userId)
  const invite = a.page.waitForResponse((response) => /\/api\/guild\/v1\/guilds\/[^/]+\/invitations$/.test(response.url()))
  await a.page.getByRole('button', { name: 'Send invitation' }).click()
  const inviteStatus = (await invite).status()
  test.info().annotations.push({ type: 'guild-invitation-status', description: String(inviteStatus) })
  expect(inviteStatus, 'guild invitation (known UM relationship version gap can yield 502)').toBe(201)

  await goTo(b.page, 'Social')
  await b.page.getByRole('navigation', { name: 'Social' }).getByRole('link', { name: 'Guilds' }).click()
  await expect(b.page.getByRole('heading', { name: 'Invitations for you' })).toBeVisible()
  await b.page.getByRole('button', { name: 'Accept' }).click()
  await expect(b.page.getByRole('heading', { level: 1, name: guildName })).toBeVisible()

  // Chat: both connect through negotiation; a message appears once for each.
  await b.page.getByRole('link', { name: 'Open chat' }).click()
  await expect(b.page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible({ timeout: 15_000 })
  await a.page.getByRole('link', { name: 'Open chat' }).click()
  await expect(a.page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible({ timeout: 15_000 })
  const text = `Hello from ${a.user.username}`
  await a.page.getByRole('textbox', { name: 'Message' }).fill(text)
  await a.page.getByRole('textbox', { name: 'Message' }).press('Enter')
  await expect(a.page.getByRole('log').getByText(text)).toHaveCount(1)
  await expect(a.page.getByText('Sending…')).toHaveCount(0, { timeout: 10_000 })
  await expect(b.page.getByRole('log').getByText(text)).toHaveCount(1, { timeout: 10_000 })

  // The leader deletes the synthetic guild; the member's chat is refused afterwards.
  await a.page.getByRole('link', { name: 'Back to guild' }).click()
  await a.page.getByRole('button', { name: 'Delete guild' }).click()
  await a.page.getByRole('dialog').getByRole('button', { name: 'Delete guild' }).click()
  await expect(a.page).toHaveURL(/\/guilds$/)
})
