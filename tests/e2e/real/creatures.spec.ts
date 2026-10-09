import { expect, test } from '@playwright/test'
import { bootstrapPackageId, newSyntheticUser, runId } from './ledger.ts'
import { requireRealTarget } from './target.ts'

test.beforeAll(() => {
  requireRealTarget()
})

test('real: a new player receives a server-created starter and can inspect it', async ({ page }) => {
  const user = newSyntheticUser(runId(), 'starter', bootstrapPackageId())
  await page.goto('/register')
  await page.getByLabel('Package').selectOption(user.packageId)
  await page.getByLabel('Username').fill(user.username)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/creatures$/)

  // The starter is minted by the server after sign-up; the client only polls (bounded).
  const name = page.locator('#creature-name')
  await expect(name).toBeVisible({ timeout: 35_000 })
  await expect(page.getByText(/Level \d+/).first()).toBeVisible()

  await page.getByRole('link', { name: 'Holders and details' }).click()
  await expect(page.getByRole('heading', { name: /Holders/ })).toBeVisible()
  await expect(page.getByText('Origin owner', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Release' })).toBeDisabled()
})
