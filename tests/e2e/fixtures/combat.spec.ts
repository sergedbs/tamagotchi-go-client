import type { Page, Request } from '@playwright/test'
import { expect, json, test, type ApiHandler } from './network.ts'
import { assetsFor, creature, GROVE, ME, problem, signIn, withGroveConfig } from './session.ts'

const LEON = '01a12000-0000-7000-8000-00000000b001'
const GUILD = '01a12000-0000-7000-8000-00000000d001'
const MOSS = '01a11f00-0000-7000-8000-00000000c001'
const RIPPLE = '01a11f00-0000-7000-8000-00000000c002'
const BATTLE = '01a13000-0000-7000-8000-00000000e001'
const RAID = '01a13000-0000-7000-8000-00000000f001'
const BOSS = '01a13000-0000-7000-8000-00000000f101'
const OPEN = '01a13000-0000-7000-8000-00000000f201'
const CLOSED = '01a13000-0000-7000-8000-00000000f202'
const SOON = '01a13000-0000-7000-8000-00000000f203'

const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()
const HOUR = 3_600_000
const empty = { items: [], next_cursor: null }

function collection(...creatures: unknown[]) {
  const [primary = null, ...secondary] = creatures
  return { user_id: ME.user_id, primary, secondary, next_cursor: null, retrieved_at: '2026-10-09T10:00:00.000Z' }
}

function battle(overrides: Record<string, unknown> = {}) {
  return {
    battle_id: BATTLE,
    challenger_id: LEON,
    opponent_id: ME.user_id,
    status: 'PENDING_ACCEPT',
    sides: [],
    turn_user_id: null,
    turn_expires_at: null,
    expires_at: at(HOUR),
    winner_id: null,
    loser_id: null,
    settlement_status: 'NOT_READY',
    access_grant_status: 'NOT_READY',
    engagement_id: null,
    version: 1,
    ...overrides,
  }
}

const sides = [
  { user_id: LEON, primary_id: '01a13000-0000-7000-8000-0000000000a1', secondary_id: '01a13000-0000-7000-8000-0000000000a2', current_hp: 60, max_hp: 80 },
  { user_id: ME.user_id, primary_id: MOSS, secondary_id: RIPPLE, current_hp: 70, max_hp: 80 },
]

/** Reads shared by every combat screen: own creatures, boosts, friends and Leon's profile. */
function playerReads(api: Map<string, ApiHandler>, creatures: unknown[] = [creature(MOSS), creature(RIPPLE, { name: 'Ripple', role: 'SECONDARY', combat_type: 'WATER' })]) {
  api.set(`GET /tamagotchi/v1/users/${ME.user_id}/collection`, (route) => json(route, 200, collection(...creatures)))
  api.set(`GET /registry/v1/packages/${GROVE}/assets`, assetsFor)
  api.set('GET /users/v1/users/me/boosts', (route) => json(route, 200, { items: [{ boost_id: 'ATTACK_10', charges: 2, attack_bps: 1000 }], next_cursor: null }))
  api.set(`GET /users/v1/users/${ME.user_id}/relationships`, (route) => json(route, 200, { items: [{ user_id: LEON, relationship: 'friend' }], next_cursor: null }))
  api.set(`GET /users/v1/users/${LEON}`, (route) => json(route, 200, { user_id: LEON, username: 'leon' }))
}

/** Serves the battle from a mutable state and counts detail reads. */
function battleDetail(api: Map<string, ApiHandler>, initial: Record<string, unknown>) {
  const state = { battle: battle(initial), reads: 0 }
  api.set(`GET /battle/v1/battles/${BATTLE}`, (route) => {
    state.reads += 1
    return json(route, 200, state.battle)
  })
  return state
}

async function choose(page: Page, lead: string, second: string) {
  await page.getByLabel('Lead creature').selectOption({ label: lead })
  await page.getByLabel('Second creature').selectOption({ label: second })
}

test.describe('fixture: battles', () => {
  test.beforeEach(async ({ page }) => {
    await withGroveConfig(page)
  })

  test('a profile challenge validates the lineup and sends one keyed command', async ({ page, api }) => {
    const sent: Request[] = []
    playerReads(api)
    api.set('GET /battle/v1/battles', (route) => json(route, 200, empty))
    api.set('POST /battle/v1/battles', (route) => {
      sent.push(route.request())
      return json(route, 201, battle({ challenger_id: ME.user_id, opponent_id: LEON }))
    })
    battleDetail(api, { challenger_id: ME.user_id, opponent_id: LEON })
    await signIn(page, api, `/combat/battles?opponent=${LEON}`)

    await expect(page.getByRole('heading', { name: 'Challenge a player' })).toBeVisible()
    await expect(page.getByLabel('Friend')).toHaveValue(LEON)
    await page.getByRole('button', { name: 'Send challenge' }).click()
    await expect(page.getByText('Choose a lead creature.')).toBeVisible()
    await expect(page.getByText('Choose a second creature.')).toBeVisible()
    expect(sent).toHaveLength(0)

    await page.getByLabel('Lead creature').selectOption({ label: 'Mossling · level 2' })
    await expect(page.getByLabel('Second creature').getByRole('option', { name: /Mossling/ })).toHaveCount(0)
    await page.getByLabel('Second creature').selectOption({ label: 'Ripple · level 2' })
    await page.getByLabel(/Use an attack boost \(\+10% attack, 2 left\)/).check()
    await page.getByRole('button', { name: 'Send challenge' }).click()

    await expect(page.getByText('Your challenge is waiting for the opponent to accept.')).toBeVisible()
    expect(sent).toHaveLength(1)
    expect(sent[0]!.postDataJSON()).toEqual({ opponent_id: LEON, primary_id: MOSS, secondary_id: RIPPLE, boost_ids: ['ATTACK_10'] })
    expect(sent[0]!.headers()['idempotency-key']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/)
  })

  test('one creature is not enough for a lineup', async ({ page, api }) => {
    playerReads(api, [creature(MOSS)])
    api.set('GET /battle/v1/battles', (route) => json(route, 200, empty))
    await signIn(page, api, `/combat/battles?opponent=${LEON}`)
    await page.getByRole('button', { name: 'Send challenge' }).click()
    await expect(page.getByText(/Battles need two of your creatures/)).toBeVisible()
  })

  test('accepting moves through preparing to the opponent turn, with attack disabled', async ({ page, api }) => {
    const bodies: unknown[] = []
    playerReads(api)
    const detail = battleDetail(api, {})
    api.set(`POST /battle/v1/battles/${BATTLE}/accept`, (route) => {
      bodies.push(route.request().postDataJSON())
      detail.battle = battle({ status: 'ONGOING', sides, turn_user_id: LEON, turn_expires_at: at(30_000), version: 3 })
      return json(route, 202, battle({ status: 'PREPARING', version: 2 }))
    })
    await signIn(page, api, `/combat/battles/${BATTLE}`)

    await expect(page.getByRole('heading', { name: 'Accept the challenge' })).toBeVisible()
    await page.getByRole('button', { name: 'Accept and fight' }).click()
    await expect(page.getByText('Choose a lead creature.')).toBeVisible()
    await choose(page, 'Ripple · level 2', 'Mossling · level 2')
    await page.getByRole('button', { name: 'Accept and fight' }).click()

    await expect(page.getByText('Both lineups are being prepared by the server.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Not your turn' })).toBeDisabled()
    await expect(page.getByRole('status').filter({ hasText: 'Waiting for leon' })).toBeVisible()
    expect(bodies).toEqual([{ primary_id: RIPPLE, secondary_id: MOSS, boost_ids: [] }])
  })

  test('declining ends the challenge without a winner', async ({ page, api }) => {
    playerReads(api)
    battleDetail(api, {})
    api.set(`POST /battle/v1/battles/${BATTLE}/reject`, (route) => json(route, 200, battle({ status: 'REJECTED', version: 2 })))
    await signIn(page, api, `/combat/battles/${BATTLE}`)
    await page.getByRole('button', { name: 'Decline' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Declined' })).toBeVisible()
    await expect(page.getByText('This battle ended without a winner.')).toBeVisible()
  })

  test('an expired challenge is explained, not retried', async ({ page, api }) => {
    playerReads(api)
    battleDetail(api, {})
    api.set(`POST /battle/v1/battles/${BATTLE}/accept`, (route) => json(route, 409, problem(409, 'challenge_expired')))
    await signIn(page, api, `/combat/battles/${BATTLE}`)
    await choose(page, 'Mossling · level 2', 'Ripple · level 2')
    await page.getByRole('button', { name: 'Accept and fight' }).click()
    await expect(page.getByText('This challenge expired.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry same request' })).toHaveCount(0)
  })

  test('my attack is the server result; polling stops once delivery is final', async ({ page, api }) => {
    const bodies: unknown[] = []
    playerReads(api)
    const detail = battleDetail(api, { status: 'ONGOING', sides, turn_user_id: ME.user_id, turn_expires_at: at(30_000), version: 4 })
    api.set(`POST /battle/v1/battles/${BATTLE}/attack`, (route) => {
      bodies.push(route.request().postDataJSON())
      detail.battle = battle({
        status: 'COMPLETED',
        sides: [{ ...sides[0], current_hp: 0 }, sides[1]],
        winner_id: ME.user_id,
        loser_id: LEON,
        settlement_status: 'DELIVERED',
        access_grant_status: 'GRANTED',
        version: 5,
      })
      return json(route, 200, { battle_id: BATTLE, attacker_id: ME.user_id, damage_dealt: 60, opponent_hp_remaining: 0, next_turn: null, status: 'COMPLETED', version: 5 })
    })
    await signIn(page, api, `/combat/battles/${BATTLE}`)

    await page.getByRole('button', { name: 'Attack' }).click()
    await expect(page.getByText(/Your attack dealt 60 damage/)).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'You won' })).toBeVisible()
    await expect(page.getByText('Delivered', { exact: true })).toBeVisible()
    await expect(page.getByText('Winner now shares the staked creature')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check status' })).toHaveCount(0)
    expect(bodies).toEqual([{ user_id: ME.user_id }])

    const reads = detail.reads
    await page.waitForTimeout(4_500)
    expect(detail.reads).toBe(reads)
  })

  test('slow delivery is polled for a bounded window, then checked on demand', async ({ page, api }) => {
    await page.clock.install()
    playerReads(api)
    const detail = battleDetail(api, { status: 'COMPLETED', sides, winner_id: LEON, loser_id: ME.user_id, settlement_status: 'PENDING', access_grant_status: 'PENDING', version: 6 })
    await signIn(page, api, `/combat/battles/${BATTLE}`)

    await expect(page.getByRole('status').filter({ hasText: 'You lost' })).toBeVisible()
    await expect(page.getByText('Being delivered')).toBeVisible()
    await expect(page.getByText('Being granted')).toBeVisible()
    const first = detail.reads
    await page.clock.runFor(4_100)
    await expect.poll(() => detail.reads).toBeGreaterThan(first)

    await page.clock.runFor(61_000)
    const settled = detail.reads
    await page.clock.runFor(10_000)
    expect(detail.reads).toBe(settled)

    await page.getByRole('button', { name: 'Check status' }).click()
    await expect.poll(() => detail.reads).toBe(settled + 1)
  })
})

const occurrence = (id: string, overrides: Record<string, unknown>) => ({ occurrence_id: id, boss_id: BOSS, boss_version: 2, status: 'active', version: 1, ...overrides })

const bossDefinition = {
  boss_id: BOSS,
  config_version: 2,
  definition: {
    name: 'Cinder Gryfon',
    description: 'A hot-tempered sky hunter.',
    sprite_ref: 'lythbound/gryfon/spicy',
    combat_type: 'FLAME',
    max_hp: 5000,
    defense: 20,
    weaknesses: ['WATER'],
    resistances: ['NATURE'],
    special_properties: {},
    duration_seconds: 900,
    max_participants: 10,
    rewards: { global_currency: 50, xp: 120 },
    defeat_rewards: null,
  },
}

function raid(overrides: Record<string, unknown> = {}) {
  return {
    raid_id: RAID,
    guild_id: GUILD,
    boss_id: BOSS,
    occurrence_id: OPEN,
    boss: { name: 'Cinder Gryfon', max_hp: 5000, current_hp: 5000, weaknesses: ['WATER'], resistances: ['NATURE'] },
    status: 'ACTIVE',
    started_at: at(-60_000),
    expires_at: at(14 * 60_000),
    ended_at: null,
    max_participants: 10,
    participant_count: 0,
    version: 1,
    reward_status: 'NOT_READY',
    ...overrides,
  }
}

/** Guild, roster and boss reads for a raid leader. */
function raidReads(api: Map<string, ApiHandler>, leader = ME.user_id) {
  playerReads(api)
  api.set(`GET /guild/v1/guilds/${GUILD}`, (route) => json(route, 200, { guild_id: GUILD, name: 'Moss Hollow', description: '', leader_id: leader, member_count: 2, version: 1 }))
  api.set(`GET /guild/v1/guilds/${GUILD}/members`, (route) =>
    json(route, 200, { guild_id: GUILD, members: [{ user_id: leader, role: 'LEADER' }, { user_id: leader === ME.user_id ? LEON : ME.user_id, role: 'MEMBER' }], version: 2, retrieved_at: at(0) }),
  )
  api.set('GET /guild/v1/invitations', (route) => json(route, 200, empty))
  api.set(`GET /registry/v1/bosses/${BOSS}`, (route) => {
    expect(new URL(route.request().url()).searchParams.get('config_version')).toBe('2')
    return json(route, 200, bossDefinition)
  })
  api.set(`GET /registry/v1/raid-occurrences/${OPEN}`, (route) => json(route, 200, occurrence(OPEN, { available_from: at(-HOUR), available_until: at(HOUR) })))
}

test.describe('fixture: raids', () => {
  test.beforeEach(async ({ page }) => {
    await withGroveConfig(page)
  })

  test('only open windows are startable, and the leader starts with guild and occurrence', async ({ page, api }) => {
    const bodies: unknown[] = []
    raidReads(api)
    api.set('GET /registry/v1/raid-occurrences', (route) =>
      json(route, 200, {
        items: [
          occurrence(OPEN, { available_from: at(-HOUR), available_until: at(HOUR) }),
          occurrence(CLOSED, { available_from: at(-3 * HOUR), available_until: at(-2 * HOUR) }),
          occurrence(SOON, { status: 'scheduled', available_from: at(2 * HOUR), available_until: at(3 * HOUR) }),
        ],
        next_cursor: null,
      }),
    )
    api.set('GET /raid/v1/raids', (route) => {
      expect(new URL(route.request().url()).searchParams.get('guild_id')).toBe(GUILD)
      return json(route, 200, empty)
    })
    api.set('POST /raid/v1/raids', (route) => {
      bodies.push(route.request().postDataJSON())
      return json(route, 201, raid())
    })
    api.set(`GET /raid/v1/raids/${RAID}`, (route) => json(route, 200, raid()))
    api.set(`GET /raid/v1/raids/${RAID}/leaderboard`, (route) => json(route, 200, { raid_id: RAID, items: [], next_cursor: null, retrieved_at: at(0), raid_version: 1 }))

    await signIn(page, api, `/guilds/${GUILD}`)
    await page.getByRole('link', { name: 'Raids' }).click()
    await expect(page.getByText(/Raiding with Moss Hollow as leader/)).toBeVisible()
    const bosses = page.getByRole('region', { name: 'Available bosses' })
    await expect(bosses.getByRole('heading', { name: 'Cinder Gryfon' })).toHaveCount(1)
    await expect(bosses.getByText(/Victory: 120 XP, 50 coins · No timeout reward/)).toBeVisible()
    await expect(bosses.getByRole('img', { name: 'Cinder Gryfon' })).toHaveAttribute('src', '/assets/creatures/lythbound/gryfon/spicy.png')

    await bosses.getByRole('button', { name: 'Start raid' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Cinder Gryfon' })).toBeVisible()
    await expect(page.getByText('No accepted attacks yet.')).toBeVisible()
    expect(bodies).toEqual([{ guild_id: GUILD, occurrence_id: OPEN }])
  })

  test('members see availability without a start action', async ({ page, api }) => {
    raidReads(api, LEON)
    api.set('GET /registry/v1/raid-occurrences', (route) =>
      json(route, 200, { items: [occurrence(SOON, { status: 'scheduled', available_from: at(2 * HOUR), available_until: at(3 * HOUR) })], next_cursor: null }),
    )
    api.set('GET /raid/v1/raids', (route) => json(route, 200, empty))
    await signIn(page, api, `/guilds/${GUILD}`)
    await page.getByRole('link', { name: 'Raids' }).click()
    await expect(page.getByText(/No boss is available right now\. The next opens in 2 hours/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start raid' })).toHaveCount(0)
  })

  test('an attack joins, waits for next_attack_at, and the leader can cancel', async ({ page, api }) => {
    const writes: string[] = []
    raidReads(api)
    let current = raid()
    let ranked = false
    api.set(`GET /raid/v1/raids/${RAID}`, (route) => json(route, 200, current))
    api.set(`GET /raid/v1/raids/${RAID}/leaderboard`, (route) =>
      json(route, 200, { raid_id: RAID, items: ranked ? [{ user_id: ME.user_id, tamagotchi_id: MOSS, damage_dealt: 240, joined_at: at(0) }] : [], next_cursor: null, retrieved_at: at(0), raid_version: current.version }),
    )
    api.set(`POST /raid/v1/raids/${RAID}/attack`, (route) => {
      writes.push(`attack ${JSON.stringify(route.request().postDataJSON())}`)
      ranked = true
      current = raid({ boss: { ...raid().boss, current_hp: 4760 }, participant_count: 1, version: 2 })
      return json(route, 200, { raid_id: RAID, attacker_id: ME.user_id, damage_dealt: 240, boss_hp_remaining: 4760, status: 'ACTIVE', raid_version: 2, accepted_at: at(0), next_attack_at: at(45_000) })
    })
    api.set(`DELETE /raid/v1/raids/${RAID}`, (route) => {
      writes.push('cancel')
      current = raid({ status: 'CANCELLED', ended_at: at(0), version: 3, reward_status: 'NOT_APPLICABLE' })
      return route.fulfill({ status: 204 })
    })
    await signIn(page, api, `/combat/raids/${RAID}`)

    await expect(page.getByText(/Mossling attacks for you/)).toBeVisible()
    await page.getByRole('button', { name: 'Attack and join' }).click()
    await expect(page.getByText(/Hit for 240\. Boss HP left: 4,760\./)).toBeVisible()
    await expect(page.getByRole('button', { name: /Ready in/ })).toBeDisabled()
    await expect(page.getByRole('complementary', { name: 'Leaderboard' }).getByText('You')).toBeVisible()

    await page.getByRole('button', { name: 'Cancel raid' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel raid' }).click()
    await expect(page.getByText('Cancelled raids pay no rewards.')).toBeVisible()
    await expect(page.getByText('Per raider')).toHaveCount(0)
    expect(writes).toEqual([`attack {"user_id":"${ME.user_id}"}`, 'cancel'])
  })

  test('a timed-out raid shows defeat semantics from the pinned boss version', async ({ page, api }) => {
    raidReads(api, LEON)
    let reads = 0
    api.set(`GET /raid/v1/raids/${RAID}`, (route) => {
      reads += 1
      return json(route, 200, raid({ status: 'FAILED', ended_at: at(-60_000), boss: { ...raid().boss, current_hp: 1200 }, reward_status: 'NOT_APPLICABLE', version: 9 }))
    })
    api.set(`GET /raid/v1/raids/${RAID}/leaderboard`, (route) => json(route, 200, { raid_id: RAID, items: [{ user_id: LEON, tamagotchi_id: MOSS, damage_dealt: 3800, joined_at: at(-HOUR) }], next_cursor: null, retrieved_at: at(0), raid_version: 9 }))
    await signIn(page, api, `/combat/raids/${RAID}`)

    await expect(page.getByText('Time ran out', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Defeat rewards apply only if this boss defines them.')).toBeVisible()
    await expect(page.getByText('None for a timeout')).toBeVisible()
    await expect(page.getByRole('button', { name: /Attack/ })).toHaveCount(0)
    await page.waitForTimeout(2_500)
    expect(reads).toBe(1)
  })
})
