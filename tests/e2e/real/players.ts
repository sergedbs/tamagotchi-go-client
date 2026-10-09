import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Browser, type Page } from '@playwright/test'
import { bootstrapPackageId, newSyntheticUser, runId, type SyntheticUser } from './ledger.ts'
import { requireRealTarget } from './target.ts'

export interface Player {
  user: SyntheticUser
  page: Page
  userId: string
}

/** Registers a synthetic player in its own browser context (separate identity). */
export async function registerPlayer(browser: Browser, label: string, geolocation?: { latitude: number; longitude: number }, packageId = bootstrapPackageId()): Promise<Player> {
  const context = await browser.newContext(geolocation ? { geolocation: { ...geolocation, accuracy: 5 }, permissions: ['geolocation'] } : {})
  const page = await context.newPage()
  const user = newSyntheticUser(runId(), label, packageId)
  await page.goto('/register')
  await page.getByLabel('Package').selectOption(user.packageId)
  await page.getByLabel('Username').fill(user.username)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  const me = page.waitForResponse((response) => response.url().endsWith('/api/users/v1/users/me') && response.ok())
  await page.getByRole('button', { name: 'Create account' }).click()
  const { user_id: userId } = (await (await me).json()) as { user_id: string }
  await expect(page).toHaveURL(/\/creatures$/)
  return { user, page, userId }
}

/** Package IDs from the latest provisioned fixture run's redacted manifest, if any. */
export function provisionedPackages(): Record<string, { package_id: string; config_version: number }> | null {
  const dir = join(process.cwd(), '.local', 'fixtures', requireRealTarget())
  if (!existsSync(dir)) return null
  const latest = readdirSync(dir)
    .filter((file) => file.endsWith('.manifest.json'))
    .map((file) => ({ file, at: statSync(join(dir, file)).mtimeMs }))
    .sort((a, b) => b.at - a.at)[0]
  if (!latest) return null
  return (JSON.parse(readFileSync(join(dir, latest.file), 'utf8')) as { packages: Record<string, { package_id: string; config_version: number }> }).packages
}

/** Client-side navigation through the app shell; a reload would end the in-memory session. */
export async function goTo(page: Page, name: 'Creatures' | 'Explore' | 'Social' | 'Combat') {
  await page.getByRole('navigation', { name: 'Main' }).filter({ visible: true }).getByRole('link', { name }).click()
}

/** Utility destinations in the shell (client-side, keeps the session). */
export async function openUtility(page: Page, name: 'Notifications' | 'Account') {
  await page.getByRole('navigation', { name: 'Utilities' }).getByRole('link', { name }).click()
}

/** Joins the first other onboardable package and waits for its server-created starter. */
export async function joinAnotherPackage(page: Page) {
  await openUtility(page, 'Account')
  const select = page.getByLabel('Join another package')
  await expect(select.locator('option')).not.toHaveCount(1)
  await select.selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Join package' }).click()
  await expect(page.getByText(/is now in your collection/)).toBeVisible({ timeout: 60_000 })
}

/** Opens a profile through the in-app lookup (client-side, keeps the session). */
export async function openProfile(page: Page, userId: string) {
  await goTo(page, 'Social')
  await page.getByLabel('Player ID').fill(userId)
  await page.getByRole('button', { name: 'Open profile' }).click()
}

/** A sends a friend request from B's profile; B accepts it in Social. */
export async function befriend(a: Player, b: Player) {
  await openProfile(a.page, b.userId)
  await expect(a.page.getByRole('heading', { name: b.user.username })).toBeVisible()
  await a.page.getByRole('button', { name: 'Send friend request' }).click()
  await expect(a.page.getByText(/Friend request sent/)).toBeVisible()
  await goTo(b.page, 'Social')
  await expect(b.page.getByText('Wants to be friends', { exact: false })).toBeVisible()
  await b.page.getByRole('button', { name: 'Accept' }).click()
  await expect(b.page.getByRole('link', { name: a.user.username })).toBeVisible()
}

/** The leader creates a guild and invites a friend, who accepts; both end on the guild page. */
export async function formGuild(leader: Player, member: Player, name: string) {
  await goTo(leader.page, 'Social')
  await leader.page.getByRole('navigation', { name: 'Social' }).getByRole('link', { name: 'Guilds' }).click()
  await leader.page.getByRole('button', { name: 'Create a guild' }).click()
  await leader.page.getByLabel('Name').fill(name)
  await leader.page.getByLabel('Description').fill('Synthetic guild for client acceptance.')
  await leader.page.getByRole('button', { name: 'Create guild' }).click()
  await expect(leader.page.getByRole('heading', { level: 1, name })).toBeVisible()
  await leader.page.getByLabel('Friend').selectOption(member.userId)
  const invite = leader.page.waitForResponse((response) => /\/api\/guild\/v1\/guilds\/[^/]+\/invitations$/.test(response.url()))
  await leader.page.getByRole('button', { name: 'Send invitation' }).click()
  const status = (await invite).status()
  expect(status, 'guild invitation (known UM relationship version gap can yield 502)').toBe(201)
  await goTo(member.page, 'Social')
  await member.page.getByRole('navigation', { name: 'Social' }).getByRole('link', { name: 'Guilds' }).click()
  await member.page.getByRole('button', { name: 'Accept' }).click()
  await expect(member.page.getByRole('heading', { level: 1, name })).toBeVisible()
  return status
}
