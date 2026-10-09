import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import type { SyntheticUser } from './ledger.ts'
import { openProfile, openUtility, registerOnPage, registerPlayer } from './players.ts'
import { requireRealTarget } from './target.ts'

// The device registration body carries the FCM token: keep it out of traces.
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

test.beforeAll(() => {
  requireRealTarget()
})

async function signIn(page: Page, user: SyntheticUser) {
  await page.goto('/account')
  await page.getByLabel('Package').selectOption(user.packageId)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: user.username })).toBeVisible()
}

async function sendFriendRequest(page: Page, toUserId: string) {
  await openProfile(page, toUserId)
  await page.getByRole('button', { name: 'Send friend request' }).click()
  await expect(page.getByText(/Friend request sent/)).toBeVisible()
}

/** Push is optional per deployment: this runs only when the served configuration enables it. */
test('real: browser push delivers real events in the foreground and background, and sign-out turns it off', async ({ browser, playwright, request, baseURL, headless }) => {
  const config = (await (await request.get('/client-config.json')).json()) as { push: unknown }
  test.skip(!config.push, 'push is not configured for this deployment')
  test.setTimeout(240_000)

  // Chrome has no Push API in incognito contexts, so the receiving player gets a real
  // profile, with the background networking its push connection needs.
  const profile = mkdtempSync(join(tmpdir(), 'tamagotchi-go-push-'))
  const context = await playwright.chromium.launchPersistentContext(profile, { channel: 'chrome', baseURL, headless, ignoreDefaultArgs: ['--disable-background-networking'] })
  try {
    await receivePush(context, browser, baseURL!)
  } finally {
    await context.close()
    rmSync(profile, { recursive: true, force: true })
  }
})

async function receivePush(context: BrowserContext, browser: Browser, baseURL: string) {
  const a = await registerOnPage(context.pages()[0] ?? (await context.newPage()), 'push-a')
  // Stands in for the player choosing Allow in the browser prompt.
  await context.grantPermissions(['notifications'], { origin: baseURL })

  await openUtility(a.page, 'Account')
  const devices = a.page.getByRole('region', { name: 'Push devices' })
  // A fresh profile's first push subscription takes Chrome about 30 s.
  const registered = a.page.waitForResponse((response) => response.url().endsWith('/api/notification/v1/devices') && response.request().method() === 'POST', { timeout: 90_000 })
  await devices.getByRole('button', { name: 'Turn on push for this browser' }).click()
  expect((await registered).status()).toBe(200)
  await expect(devices.getByText('Push is on for this browser.').first()).toBeVisible()
  await expect(devices.getByText('Web browser · This browser')).toBeVisible()

  // Foreground: the visible app receives the push from its worker and refreshes the inbox.
  await a.page.evaluate(() => {
    const seen = window as unknown as { __pushes: number }
    seen.__pushes = 0
    navigator.serviceWorker.addEventListener('message', (event) => {
      if ((event.data as { isFirebaseMessaging?: boolean } | null)?.isFirebaseMessaging) seen.__pushes += 1
    })
  })
  const b = await registerPlayer(browser, 'push-b')
  await sendFriendRequest(b.page, a.userId)
  await expect.poll(() => a.page.evaluate(() => (window as unknown as { __pushes: number }).__pushes), { timeout: 45_000 }).toBeGreaterThan(0)
  const bell = a.page.getByRole('navigation', { name: 'Utilities' }).getByRole('link', { name: /^Notifications/ })
  await expect(bell).toHaveAccessibleName(/unread/, { timeout: 10_000 })

  // Background: with no app page open, the worker shows a templated system notification.
  await a.page.close()
  const c = await registerPlayer(browser, 'push-c')
  await sendFriendRequest(c.page, a.userId)
  const shown = async () => {
    for (const worker of context.serviceWorkers()) {
      try {
        return await worker.evaluate(async () => {
          const scope = self as unknown as { registration: ServiceWorkerRegistration }
          return (await scope.registration.getNotifications()).map((item) => ({ title: item.title, tag: item.tag, href: (item.data as { href?: string } | null)?.href ?? null }))
        })
      } catch {
        // A stopped worker; the next poll sees the restarted one.
      }
    }
    return []
  }
  await expect.poll(shown, { timeout: 60_000, intervals: [1_000] }).toContainEqual(expect.objectContaining({ title: `${c.user.username} wants to be friends`, href: '/social' }))
  const notification = (await shown()).find((item) => item.title === `${c.user.username} wants to be friends`)!

  // The same browser keeps push across sessions; the tag is the inbox record's ID.
  const page = await context.newPage()
  await signIn(page, a.user)
  await expect(page.getByRole('region', { name: 'Push devices' }).getByText('Web browser · This browser')).toBeVisible()
  const inbox = page.waitForResponse((response) => response.url().includes(`/api/notification/v1/users/${a.userId}/notifications`) && response.ok())
  await openUtility(page, 'Notifications')
  const items = ((await (await inbox).json()) as { items: { id: string; type: string; delivery_status: string; params: Record<string, unknown> }[] }).items
  const record = items.find((item) => item.id === notification.tag)
  expect(record?.type).toBe('FRIEND_REQUEST')
  test.info().annotations.push({ type: 'delivery-status', description: items.map((item) => `${item.type}:${item.delivery_status}`).join(', ') })

  // Signing out removes the device and the subscription, so the next account here gets nothing.
  await openUtility(page, 'Account')
  const removed = page.waitForResponse((response) => /\/api\/notification\/v1\/devices\/[^/]+$/.test(response.url()) && response.request().method() === 'DELETE')
  await page.getByRole('button', { name: 'Sign out' }).click()
  expect((await removed).status()).toBe(204)
  await expect(page.getByText('You are signed out.')).toBeVisible()
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0)
  await signIn(page, a.user)
  await expect(page.getByRole('region', { name: 'Push devices' }).getByText('No devices are registered.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Turn on push for this browser' })).toBeVisible()
}
