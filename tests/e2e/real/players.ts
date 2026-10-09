import { expect, type Browser, type Page } from '@playwright/test'
import { bootstrapPackageId, newSyntheticUser, runId, type SyntheticUser } from './ledger.ts'

export interface Player {
  user: SyntheticUser
  page: Page
  userId: string
}

/** Registers a synthetic player in its own browser context (separate identity). */
export async function registerPlayer(browser: Browser, label: string, geolocation?: { latitude: number; longitude: number }): Promise<Player> {
  const context = await browser.newContext(geolocation ? { geolocation: { ...geolocation, accuracy: 5 }, permissions: ['geolocation'] } : {})
  const page = await context.newPage()
  const user = newSyntheticUser(runId(), label, bootstrapPackageId())
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
