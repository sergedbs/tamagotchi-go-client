import { expect, test } from '@playwright/test'
import { befriend, formGuild, registerPlayer } from './players.ts'
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
  await befriend(a, b)
  await expect(b.page.getByText('No pending requests.')).toBeVisible()

  // Guild created by A, B invited from the friends list and accepting.
  const guildName = `Grove ${runId()}`
  const inviteStatus = await formGuild(a, b, guildName)
  test.info().annotations.push({ type: 'guild-invitation-status', description: String(inviteStatus) })
  await expect(a.page.getByText('You are leader')).toBeVisible()

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
