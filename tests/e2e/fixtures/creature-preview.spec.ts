import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './network.ts'

// Design preview route (dev build only): sample data, no /api calls at all.
test.describe('fixture: creature home design preview', () => {
  for (const width of [360, 390, 768, 1440]) {
    test(`renders without horizontal overflow at ${width}px`, async ({ page, api }) => {
      void api
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/__preview/creatures')
      await expect(page.getByRole('heading', { level: 1, name: 'Mossling' })).toBeVisible()
      await expect(page.getByRole('img', { name: 'Mossling' })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBe(0)
    })
  }

  test('keyboard reaches navigation and every care action', async ({ page, api }) => {
    void api
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/__preview/creatures')
    await expect(page.getByRole('button', { name: /Feed/ })).toBeVisible()
    const reached = new Set<string>()
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab')
      reached.add(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.innerText?.trim().split(/\s+/)[0] ?? ''))
    }
    for (const name of ['Creatures', 'Explore', 'Social', 'Combat', 'Feed', 'Play', 'Rest']) expect(reached).toContain(name)
  })

  test('care feedback is local to the action and mentions pending currency', async ({ page, api }) => {
    void api
    await page.goto('/__preview/creatures')
    await page.getByRole('button', { name: /Feed/ }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Feed recorded' })).toContainText('Currency reward pending')
  })

  test('unknown package disables care with an explanation and a labelled art fallback', async ({ page, api }) => {
    void api
    await page.goto('/__preview/creatures?state=unknown-package')
    await expect(page.getByText(/care actions stay off/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Feed/ })).toHaveCount(0)
    await expect(page.getByRole('img', { name: 'Mossling: artwork unavailable' })).toBeVisible()
  })

  for (const state of ['default', 'unknown-package', 'care-error', 'unavailable']) {
    test(`has no detectable accessibility violations (${state})`, async ({ page, api }) => {
      void api
      await page.goto(`/__preview/creatures?state=${state}`)
      await page.waitForLoadState('networkidle')
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
    })
  }
})

test.describe('fixture: credits', () => {
  test('shows exact artwork attribution without signing in', async ({ page, api }) => {
    void api
    await page.goto('/credits')
    await expect(page.getByRole('heading', { name: 'Credits' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Jackalune' })).toHaveAttribute('href', 'https://jackalune.itch.io/')
    await expect(page.getByText('Laguna, Igalyph and Nimblithe by')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Toripng' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Creative Commons Attribution 4.0 International' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'full license text' })).toHaveAttribute('href', '/assets/creatures/lythbound/LICENSE.txt')
    await expect(page.getByText('PNG bytes unchanged; directory and file names lowercased.')).toBeVisible()
  })
})
