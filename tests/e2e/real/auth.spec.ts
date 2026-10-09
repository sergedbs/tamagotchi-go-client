import { expect, test } from '@playwright/test'
import { bootstrapPackageId, newSyntheticUser, runId } from './ledger.ts'
import { requireRealTarget } from './target.ts'

test.beforeAll(() => {
  requireRealTarget()
})

test.describe('real: registration, sign-in and sign-out through Gateway', () => {
  test('registers a synthetic player, signs out, and signs back in', async ({ page }) => {
    const user = newSyntheticUser(runId(), 'auth', bootstrapPackageId())
    const apiErrors: string[] = []
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 500) apiErrors.push(`${response.status()} ${new URL(response.url()).pathname}`)
    })

    await page.goto('/register')
    await page.getByLabel('Package').selectOption(user.packageId)
    await page.getByLabel('Username').fill(user.username)
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password').fill(user.password)
    const registration = page.waitForResponse((response) => response.url().endsWith('/api/users/v1/users/register'))
    await page.getByRole('button', { name: 'Create account' }).click()
    expect((await registration).status()).toBe(201)
    await expect(page).toHaveURL(/\/creatures/)

    await page.goto('/account')
    // A full navigation reloads the page, so the in-memory session is gone by design.
    await expect(page).toHaveURL(/\/login\?next=%2Faccount$/)
    await page.getByLabel('Package').selectOption(user.packageId)
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password').fill(user.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: user.username })).toBeVisible()

    const logout = page.waitForResponse((response) => response.url().endsWith('/api/users/v1/auth/logout'))
    await page.getByRole('button', { name: 'Sign out' }).click()
    expect((await logout).status()).toBe(204)
    await expect(page.getByText('You are signed out.')).toBeVisible()
    expect(apiErrors).toEqual([])
  })

  test('wrong password is refused as invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Package').selectOption(bootstrapPackageId())
    await page.getByLabel('Email').fill(`e2e+nobody-${runId()}@example.test`)
    await page.getByLabel('Password').fill('definitely-not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('alert')).toContainText(/incorrect|Too many attempts/)
  })
})
