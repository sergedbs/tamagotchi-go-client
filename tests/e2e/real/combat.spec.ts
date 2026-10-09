import { expect, test } from '@playwright/test'
import { goTo, joinAnotherPackage, openProfile, registerPlayer, type Player } from './players.ts'
import { requireRealTarget } from './target.ts'

test.beforeAll(() => {
  requireRealTarget()
})

const finished = (player: Player) => player.page.getByRole('status').filter({ hasText: /You won|You lost/ })

/** Waits until one player can attack, or returns null once the server ended the battle. */
async function playerOnTurn(players: Player[]): Promise<Player | null> {
  let current: Player | null = null
  let over = false
  await expect
    .poll(
      async () => {
        for (const player of players) {
          if ((await finished(player).count()) > 0) {
            over = true
            return true
          }
          const attack = player.page.getByRole('button', { name: 'Attack', exact: true })
          if ((await attack.count()) > 0 && (await attack.isEnabled())) {
            current = player
            return true
          }
        }
        return false
      },
      { timeout: 40_000 },
    )
    .toBe(true)
  return over ? null : current
}

test('real: two players battle with server turns, then a forfeit settles it', async ({ browser }) => {
  test.setTimeout(300_000)
  const a = await registerPlayer(browser, 'battle-a')
  const b = await registerPlayer(browser, 'battle-b')

  // A lineup needs two held creatures: each player joins a second package.
  await joinAnotherPackage(a.page)
  await joinAnotherPackage(b.page)

  // A challenges B from B's profile.
  await openProfile(a.page, b.userId)
  await a.page.getByRole('link', { name: 'Challenge to a battle' }).click()
  await a.page.getByLabel('Lead creature').selectOption({ index: 1 })
  await a.page.getByLabel('Second creature').selectOption({ index: 1 })
  const created = a.page.waitForResponse((response) => response.url().endsWith('/api/battle/v1/battles') && response.request().method() === 'POST')
  await a.page.getByRole('button', { name: 'Send challenge' }).click()
  expect((await created).status()).toBe(201)
  await expect(a.page.getByText('Your challenge is waiting for the opponent to accept.')).toBeVisible()

  // B finds it in the battle list and accepts with their own lineup.
  await goTo(b.page, 'Combat')
  await b.page.getByRole('link', { name: /Challenge for you/ }).click()
  await b.page.getByLabel('Lead creature').selectOption({ index: 1 })
  await b.page.getByLabel('Second creature').selectOption({ index: 1 })
  const accepted = b.page.waitForResponse((response) => /\/api\/battle\/v1\/battles\/[^/]+\/accept$/.test(response.url()))
  await b.page.getByRole('button', { name: 'Accept and fight' }).click()
  const acceptResponse = await accepted
  const acceptBody = (await acceptResponse.json()) as { status: string }
  test.info().annotations.push({ type: 'accept', description: `${acceptResponse.status()} ${acceptBody.status}` })
  expect(acceptResponse.ok()).toBe(true)

  // Turns alternate as the server decides and expire on a short server timer, so a
  // round retries when the turn moves between finding the attacker and clicking.
  for (let round = 0; round < 2; round++) {
    if ((await finished(a).count()) > 0 || (await finished(b).count()) > 0) break
    await expect(async () => {
      const attacker = await playerOnTurn([a, b])
      // An expired turn ends the battle on the server; that is a valid end here.
      if (!attacker) return
      const waiting = attacker === a ? b : a
      await expect(waiting.page.getByRole('button', { name: 'Not your turn' })).toBeDisabled({ timeout: 3_000 })
      const reply = attacker.page.waitForResponse((response) => /\/attack$/.test(response.url()), { timeout: 5_000 })
      await attacker.page.getByRole('button', { name: 'Attack', exact: true }).click({ timeout: 2_000 })
      expect((await reply).ok()).toBe(true)
    }).toPass({ timeout: 90_000 }).catch(async (error: unknown) => {
      for (const [name, player] of [['a', a], ['b', b]] as const) {
        const state = await player.page.locator('main').innerText().catch(() => 'unreadable')
        test.info().annotations.push({ type: `stuck-${name}`, description: state.replace(/\s+/g, ' ').slice(0, 400) })
      }
      throw error
    })
  }

  // B forfeits if the battle is still running; both sides see the server's result.
  if ((await finished(b).count()) === 0) {
    await b.page.getByRole('button', { name: 'Forfeit' }).click()
    await b.page.getByRole('dialog').getByRole('button', { name: 'Forfeit' }).click()
  }
  await expect(finished(b)).toBeVisible({ timeout: 15_000 })
  await expect(finished(a)).toBeVisible({ timeout: 15_000 })
  const outcomes = [(await finished(a).innerText()).trim(), (await finished(b).innerText()).trim()].sort()
  expect(outcomes).toEqual(['You lost', 'You won'])

  for (const player of [a, b]) {
    const delivery = player.page.getByRole('region', { name: 'After the battle' })
    await expect(delivery).toBeVisible()
    test.info().annotations.push({ type: `delivery-${player === a ? 'a' : 'b'}`, description: (await delivery.locator('dl').innerText()).replace(/\s+/g, ' ') })
  }
})
