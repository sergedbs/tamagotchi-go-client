import { expect, test } from '@playwright/test'
import { goTo, joinAnotherPackage, openProfile, registerPlayer, type Player } from './players.ts'
import { requireRealTarget } from './target.ts'

test.beforeAll(() => {
  requireRealTarget()
})

/** Waits until exactly one player can attack, according to the server's turn. */
async function playerOnTurn(players: Player[]): Promise<Player> {
  let current: Player | null = null
  await expect
    .poll(
      async () => {
        for (const player of players) {
          const attack = player.page.getByRole('button', { name: 'Attack', exact: true })
          if ((await attack.count()) > 0 && (await attack.isEnabled())) {
            current = player
            return true
          }
        }
        return false
      },
      { timeout: 20_000 },
    )
    .toBe(true)
  return current!
}

const finished = (player: Player) => player.page.getByRole('status').filter({ hasText: /You won|You lost/ })

test('real: two players battle with server turns, then a forfeit settles it', async ({ browser }) => {
  test.setTimeout(240_000)
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

  // Turns alternate as the server decides; the waiting side cannot attack.
  for (let round = 0; round < 2; round++) {
    const attacker = await playerOnTurn([a, b])
    const waiting = attacker === a ? b : a
    await expect(waiting.page.getByRole('button', { name: 'Not your turn' })).toBeDisabled()
    await attacker.page.getByRole('button', { name: 'Attack', exact: true }).click()
    await expect(attacker.page.getByText(/Your attack dealt \d+ damage/)).toBeVisible()
    if ((await finished(attacker).count()) > 0) break
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
