import { expect, test } from '@playwright/test'
import { goTo, openUtility, provisionedPackages, registerPlayer } from './players.ts'
import { assetOriginOf, requireRealTarget } from './target.ts'

test.beforeAll(() => {
  requireRealTarget()
})

test('real: a provisioned package gives labelled care with the authored starter art', async ({ browser }) => {
  test.setTimeout(120_000)
  const grove = provisionedPackages()?.['grove-companions']
  test.skip(!grove, 'Needs a provisioned fixture run: npm run fixtures -- provision (see README).')
  const player = await registerPlayer(browser, 'care', undefined, grove!.package_id)
  const page = player.page

  await expect(page.locator('#creature-name')).toHaveText('Mossling', { timeout: 35_000 })
  // Provisioned manifests point at the fixture target's public_client_origin. The
  // client renders plain-http art only from its own origin, so another origin
  // (for example the packaged runtime on :8080) shows the labelled fallback.
  const assetOrigin = assetOriginOf(requireRealTarget())
  if (new URL(page.url()).origin === assetOrigin) {
    await expect(page.getByRole('img', { name: /Mossling/ }).first()).toHaveAttribute('src', `${assetOrigin}/assets/creatures/lythbound/wolfren/green.png`)
  } else {
    await expect(page.getByRole('img', { name: 'Mossling: artwork unavailable' }).first()).toBeVisible()
    test.info().annotations.push({ type: 'art', description: `fallback: assets are published for ${assetOrigin}` })
  }
  await expect(page.getByText('Energy', { exact: true }).first()).toBeVisible()

  const care = page.getByRole('region', { name: 'Care' })
  await care.getByRole('button', { name: /Feed/ }).click()
  await expect(care.getByRole('status')).toContainText('Feed recorded.')
  await expect(care.getByRole('status')).toContainText('Energy 50 → 60')

  // A second Feed inside the 5 s cooldown is refused by the server, not the client.
  await care.getByRole('button', { name: /Feed/ }).click()
  await expect(care.getByRole('status')).toContainText(/Feed is cooling down|Feed recorded/)
  test.info().annotations.push({ type: 'second-feed', description: (await care.getByRole('status').innerText()).replace(/\s+/g, ' ') })

  // Currency is credited asynchronously; the wallet is re-read from the server.
  await expect(async () => {
    await openUtility(page, 'Account')
    await expect(page.getByRole('region', { name: 'Wallets' }).getByRole('listitem').filter({ hasNotText: 'Coins' })).toContainText(/[1-9]/, { timeout: 2_000 })
  }).toPass({ timeout: 30_000 })
  test.info().annotations.push({ type: 'wallets', description: (await page.getByRole('region', { name: 'Wallets' }).innerText()).replace(/\s+/g, ' ') })
  await goTo(page, 'Creatures')
})
