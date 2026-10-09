import { expect, test, type Page } from '@playwright/test'
import { adminLogin, runId } from './ledger.ts'
import { befriend, formGuild, openUtility, provisionedPackages, registerPlayer, type Player } from './players.ts'
import { requireRealTarget } from './target.ts'

// The admin password is typed into the client; keep it out of traces, screenshots and video.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

test.beforeAll(() => {
  requireRealTarget()
})

async function signInAdmin(page: Page) {
  const admin = adminLogin()
  await page.goto('/login')
  await page.getByLabel('Package').selectOption(admin.packageId)
  await page.getByLabel('Email').fill(admin.email)
  await page.getByLabel('Password').fill(admin.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/creatures/)
}

async function openAdmin(page: Page, section: 'Packages' | 'Bosses' | 'Occurrences') {
  await page.getByRole('navigation', { name: 'Utilities' }).getByRole('link', { name: 'Admin' }).click()
  await page.getByRole('navigation', { name: 'Administration' }).getByRole('link', { name: section }).click()
}

/** Attacks once when ready; returns false once the raid is no longer active. */
async function attack(player: Player): Promise<boolean> {
  const button = player.page.getByRole('button', { name: /^(Attack|Ready in)/ })
  if ((await button.count()) === 0) return false
  await expect(button).toBeEnabled({ timeout: 60_000 })
  const reply = player.page.waitForResponse((response) => /\/api\/raid\/v1\/raids\/[^/]+\/attack$/.test(response.url()))
  await button.click()
  const response = await reply
  test.info().annotations.push({ type: `attack-${player.user.username.slice(-6)}`, description: String(response.status()) })
  return response.ok()
}

test('real: an admin opens a run-named boss, and a guild raids it to the end', async ({ browser }) => {
  test.setTimeout(300_000)
  const grove = provisionedPackages()?.['grove-companions']
  test.skip(!grove, 'Needs a provisioned fixture run: npm run fixtures -- provision (see README).')
  const run = runId()
  const bossName = `E2E Gryfon ${run}`

  // Admin: create a small boss, version it, and open a 30-minute occurrence.
  const adminContext = await browser.newContext()
  const admin = await adminContext.newPage()
  await signInAdmin(admin)
  await openAdmin(admin, 'Bosses')
  await admin.getByRole('button', { name: 'Create a boss' }).click()
  const create = admin.getByRole('region', { name: 'Create a boss' })
  await create.getByLabel('Name').fill(bossName)
  await create.getByLabel('Max HP').fill('15')
  await create.getByLabel('Defense').fill('0')
  await create.getByLabel('Duration (seconds)').fill('600')
  await create.getByRole('group', { name: 'Weak to' }).getByLabel('Water').check()
  await create.getByLabel('XP', { exact: true }).fill('5')
  await create.getByLabel('Coins', { exact: true }).fill('3')
  await create.getByRole('button', { name: 'Create boss' }).click()
  await expect(admin.getByRole('heading', { level: 1, name: bossName })).toBeVisible()
  await admin.getByLabel('Description').fill('Synthetic boss for client acceptance.')
  await admin.getByRole('button', { name: 'Save as version 2' }).click()
  await expect(admin.getByText('Saved as version 2.')).toBeVisible()

  await openAdmin(admin, 'Occurrences')
  await admin.getByRole('button', { name: 'Schedule an occurrence' }).click()
  const schedule = admin.getByRole('region', { name: 'Schedule an occurrence' })
  await schedule.getByLabel('Boss', { exact: true }).selectOption({ label: `${bossName} (v2)` })
  const local = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
  await schedule.getByLabel('Opens').fill(local(Date.now() - 60_000))
  await schedule.getByLabel('Closes').fill(local(Date.now() + 30 * 60_000))
  await schedule.getByRole('button', { name: 'Schedule occurrence' }).click()
  const row = admin.getByRole('row', { name: new RegExp(bossName) })
  await expect(row).toBeVisible()
  test.info().annotations.push({ type: 'occurrence-created', description: (await row.innerText()).replace(/\s+/g, ' ') })
  if ((await row.getByRole('button', { name: 'Activate' }).count()) > 0) await row.getByRole('button', { name: 'Activate' }).click()
  await expect(row.getByText('active', { exact: true })).toBeVisible()
  await expect(row.getByText('Open now')).toBeVisible()

  // A run-named package's metadata round trip (If-Match on the provisioned package).
  await openAdmin(admin, 'Packages')
  await admin.locator(`a[href="/admin/packages/${grove!.package_id}"]`).click()
  await admin.getByLabel('Description').fill(`Synthetic package for client acceptance (${run}).`)
  await admin.getByRole('button', { name: 'Save metadata' }).click()
  await expect(admin.getByText(/Saved as revision \d+\./)).toBeVisible()

  // Players: a leader and a member in a guild, both with primary starters.
  const leader = await registerPlayer(browser, 'raid-lead', undefined, grove!.package_id)
  const member = await registerPlayer(browser, 'raid-member', undefined, grove!.package_id)
  await expect(leader.page.locator('#creature-name')).toBeVisible({ timeout: 35_000 })
  await expect(member.page.locator('#creature-name')).toBeVisible({ timeout: 35_000 })
  await befriend(leader, member)
  await formGuild(leader, member, `Raiders ${run}`)

  // The leader starts the raid from the guild's raid page.
  await leader.page.getByRole('link', { name: 'Raids' }).click()
  const card = leader.page.getByRole('region', { name: 'Available bosses' }).getByRole('listitem').filter({ hasText: bossName })
  await expect(card).toBeVisible({ timeout: 30_000 })
  await expect(async () => {
    await card.getByRole('button', { name: 'Start raid' }).click()
    await expect(leader.page.getByRole('heading', { level: 1, name: bossName })).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 60_000 })
  const raidUrl = leader.page.url()
  test.info().annotations.push({ type: 'raid', description: raidUrl.split('/').pop()! })

  // The member follows the guild raid list to the same raid.
  await member.page.getByRole('link', { name: 'Raids' }).click()
  await member.page.getByRole('link', { name: new RegExp(bossName) }).click()
  await expect(member.page.getByRole('heading', { level: 1, name: bossName })).toBeVisible()

  // Alternate attacks (member first, so both are admitted) until the server ends the raid.
  for (let round = 0; round < 12; round++) {
    const stillActive = (await attack(member)) && (await attack(leader))
    if (!stillActive) break
    if ((await leader.page.getByText('Boss defeated').count()) > 0) break
  }
  await expect(leader.page.getByText('Boss defeated').first()).toBeVisible({ timeout: 30_000 })
  await expect(leader.page.getByText('Victory rewards go to admitted participants.')).toBeVisible()
  const board = leader.page.getByRole('complementary', { name: 'Leaderboard' })
  await expect(board.getByRole('listitem')).toHaveCount(2)
  test.info().annotations.push({ type: 'outcome', description: (await leader.page.locator('dl').last().innerText()).replace(/\s+/g, ' ') })

  // Victory XP and coins arrive asynchronously; the wallet is re-read.
  await expect(async () => {
    await openUtility(member.page, 'Account')
    await expect(member.page.getByRole('region', { name: 'Wallets' }).getByRole('listitem').filter({ hasText: 'Coins' })).toContainText(/[1-9]/, { timeout: 2_000 })
  }).toPass({ timeout: 60_000 })

  // Cleanup: the admin cancels this run's occurrence so it is not offered to other players.
  await openAdmin(admin, 'Occurrences')
  const ours = admin.getByRole('row', { name: new RegExp(bossName) })
  await ours.getByRole('button', { name: 'Cancel' }).click()
  await admin.getByRole('dialog').getByRole('button', { name: 'Cancel occurrence' }).click()
  await expect(ours.getByText('cancelled')).toBeVisible()
  await adminContext.close()
})
