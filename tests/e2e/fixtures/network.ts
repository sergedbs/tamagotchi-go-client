import { test as base, expect, type Route } from '@playwright/test'

export type ApiHandler = (route: Route, url: URL) => Promise<void> | void

/**
 * Fixture-only network layer. Unhandled /api requests are refused and fail the
 * test, so a fixture run can never reach the real Gateway by accident.
 */
export const test = base.extend<{ api: Map<string, ApiHandler>; unexpectedApiCalls: string[] }>({
  unexpectedApiCalls: async ({}, use) => {
    await use([])
  },
  api: async ({ page, unexpectedApiCalls }, use) => {
    const handlers = new Map<string, ApiHandler>()
    await page.route(/\/api(\/|$)/, async (route) => {
      const url = new URL(route.request().url())
      const key = `${route.request().method()} ${url.pathname.replace(/^\/api/, '')}`
      const handler = handlers.get(key)
      if (handler) return handler(route, url)
      unexpectedApiCalls.push(key)
      return route.abort('blockedbyclient')
    })
    await use(handlers)
    expect(unexpectedApiCalls, 'unhandled /api calls in a fixture test').toEqual([])
  },
})

export { expect }

export function json(route: Route, status: number, body: unknown, headers: Record<string, string> = {}) {
  const problem = status >= 400
  return route.fulfill({
    status,
    contentType: problem ? 'application/problem+json' : 'application/json',
    headers,
    body: JSON.stringify(body),
  })
}
