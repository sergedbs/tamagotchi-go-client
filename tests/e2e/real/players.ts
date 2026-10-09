import { expect, type Browser, type Page } from '@playwright/test'
import { bootstrapPackageId, newSyntheticUser, runId, type SyntheticUser } from './ledger.ts'

export interface Player {
  user: SyntheticUser
  page: Page
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
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/creatures$/)
  return { user, page }
}

/** Client-side navigation through the app shell; a reload would end the in-memory session. */
export async function goTo(page: Page, name: 'Creatures' | 'Explore' | 'Social' | 'Combat') {
  await page.getByRole('navigation', { name: 'Main' }).first().getByRole('link', { name }).click()
}
