import type { Request } from '@playwright/test'
import { expect, json, test } from './network.ts'
import { ME, problem, signIn } from './session.ts'

const LEON = '01a12000-0000-7000-8000-00000000b001'
const GUILD = '01a12000-0000-7000-8000-00000000d001'
const emptyCollection = { user_id: ME.user_id, primary: null, secondary: [], next_cursor: null, retrieved_at: '2026-10-09T10:00:00.000Z' }
const later = () => new Date(Date.now() + 86_400_000).toISOString()

test.describe('fixture: people and profiles', () => {
  test.beforeEach(async ({ api }) => {
    api.set(`GET /tamagotchi/v1/users/${ME.user_id}/collection`, (route) => json(route, 200, emptyCollection))
    api.set(`GET /users/v1/users/${LEON}`, (route) => json(route, 200, { user_id: LEON, username: 'leon' }))
  })

  test('accepting a request uses a command key and reconciles both lists', async ({ page, api }) => {
    let accepted = false
    const sent: Request[] = []
    api.set(`GET /users/v1/users/${ME.user_id}/relationships`, (route) => json(route, 200, { items: accepted ? [{ user_id: LEON, relationship: 'friend' }] : [], next_cursor: null }))
    api.set('GET /users/v1/friend-requests', (route) =>
      json(route, 200, { items: accepted ? [] : [{ request_id: 'r1', from_user_id: LEON, to_user_id: ME.user_id, status: 'PENDING', expires_at: later() }], next_cursor: null }),
    )
    api.set('POST /users/v1/friend-requests/r1/accept', (route) => {
      sent.push(route.request())
      accepted = true
      return json(route, 200, { request_id: 'r1', from_user_id: LEON, to_user_id: ME.user_id, status: 'ACCEPTED', expires_at: later() })
    })
    await signIn(page, api, '/social')
    await expect(page.getByText(/Wants to be friends/)).toBeVisible()
    await page.getByRole('button', { name: 'Accept' }).click()
    await expect(page.getByRole('region', { name: /Friends/ }).getByRole('link', { name: 'leon' })).toBeVisible()
    await expect(page.getByText('No pending requests.')).toBeVisible()
    expect(sent[0]?.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{14}7/)
  })

  test('profile actions: request, then confirmed unfriend and enemy mark', async ({ page, api }) => {
    let relationship: 'stranger' | 'friend' | 'enemy' = 'stranger'
    const writes: string[] = []
    api.set(`GET /users/v1/users/${ME.user_id}/relationships`, (route) => json(route, 200, { items: relationship === 'stranger' ? [] : [{ user_id: LEON, relationship }], next_cursor: null }))
    api.set('GET /users/v1/friend-requests', (route) => json(route, 200, { items: [], next_cursor: null }))
    api.set('POST /users/v1/friend-requests', (route) => {
      writes.push(`POST ${JSON.stringify(route.request().postDataJSON())}`)
      relationship = 'friend'
      return json(route, 201, { request_id: 'r2', from_user_id: ME.user_id, to_user_id: LEON, status: 'PENDING', expires_at: later() })
    })
    api.set(`DELETE /users/v1/users/${ME.user_id}/friends/${LEON}`, (route) => {
      writes.push('DELETE friend')
      relationship = 'stranger'
      return route.fulfill({ status: 204 })
    })
    api.set(`PUT /users/v1/users/${ME.user_id}/enemies/${LEON}`, (route) => {
      writes.push('PUT enemy')
      relationship = 'enemy'
      return json(route, 200, { relationship: 'enemy', reverse_relationship: 'stranger', version: 3 })
    })
    await signIn(page, api, `/players/${LEON}`)
    await expect(page.getByRole('heading', { name: 'leon' })).toBeVisible()
    await page.getByRole('button', { name: 'Send friend request' }).click()
    await expect(page.getByRole('button', { name: 'Unfriend' })).toBeVisible()
    await page.getByRole('button', { name: 'Unfriend' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Unfriend' }).click()
    await expect(page.getByRole('button', { name: 'Send friend request' })).toBeVisible()
    await page.getByRole('button', { name: 'Mark as enemy' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Mark as enemy' }).click()
    await expect(page.getByRole('button', { name: 'Remove enemy mark' })).toBeVisible()
    expect(writes).toEqual([`POST {"to_user_id":"${LEON}"}`, 'DELETE friend', 'PUT enemy'])
  })

  test('player lookup accepts only a full UUID', async ({ page, api }) => {
    api.set(`GET /users/v1/users/${ME.user_id}/relationships`, (route) => json(route, 200, { items: [], next_cursor: null }))
    api.set('GET /users/v1/friend-requests', (route) => json(route, 200, { items: [], next_cursor: null }))
    await signIn(page, api, '/social')
    await page.getByRole('textbox', { name: 'Player ID' }).fill('leon')
    await page.getByRole('button', { name: 'Open profile' }).click()
    await expect(page.getByText('Enter a full player ID')).toBeVisible()
  })
})

test.describe('fixture: guild management', () => {
  const guild = { guild_id: GUILD, name: 'Moss Hollow', description: 'Gentle explorers', leader_id: ME.user_id, member_count: 2, version: 4 }

  test.beforeEach(async ({ api }) => {
    api.set(`GET /tamagotchi/v1/users/${ME.user_id}/collection`, (route) => json(route, 200, emptyCollection))
    api.set(`GET /users/v1/users/${LEON}`, (route) => json(route, 200, { user_id: LEON, username: 'leon' }))
    api.set(`GET /guild/v1/guilds/${GUILD}`, (route) => json(route, 200, guild))
    api.set('GET /guild/v1/invitations', (route) => json(route, 200, { items: [], next_cursor: null }))
    api.set(`GET /users/v1/users/${ME.user_id}/relationships`, (route) => json(route, 200, { items: [], next_cursor: null }))
  })

  test('role change sends expected_guild_version; a conflict reloads the roster', async ({ page, api }) => {
    const bodies: unknown[] = []
    let version = 4
    api.set(`GET /guild/v1/guilds/${GUILD}/members`, (route) =>
      json(route, 200, { guild_id: GUILD, members: [{ user_id: ME.user_id, role: 'LEADER' }, { user_id: LEON, role: 'MEMBER' }], version, retrieved_at: new Date().toISOString() }),
    )
    api.set(`PATCH /guild/v1/guilds/${GUILD}/members/${LEON}/role`, (route) => {
      bodies.push(route.request().postDataJSON())
      version = 5
      return json(route, 409, problem(409, 'version_conflict'))
    })
    await signIn(page, api, `/guilds/${GUILD}`)
    await expect(page.getByText('You are leader')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Leave guild' })).toBeDisabled()
    await page.getByRole('button', { name: 'Make officer' }).click()
    await expect(page.getByText('The roster changed; it has been reloaded.')).toBeVisible()
    expect(bodies[0]).toEqual({ role: 'OFFICER', expected_guild_version: 4 })
  })

  test('non-members see invitation-only membership and no chat', async ({ page, api }) => {
    api.set(`GET /guild/v1/guilds/${GUILD}/members`, (route) => json(route, 200, { guild_id: GUILD, members: [{ user_id: LEON, role: 'LEADER' }], version: 1, retrieved_at: new Date().toISOString() }))
    await signIn(page, api, `/guilds/${GUILD}`)
    await expect(page.getByText('Membership is by invitation.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open chat' })).toHaveCount(0)
  })
})

test.describe('fixture: guild chat protocol', () => {
  test.beforeEach(async ({ api }) => {
    api.set(`GET /tamagotchi/v1/users/${ME.user_id}/collection`, (route) => json(route, 200, emptyCollection))
    api.set(`GET /guild/v1/guilds/${GUILD}`, (route) => json(route, 200, { guild_id: GUILD, name: 'Moss Hollow', description: '', leader_id: ME.user_id, member_count: 1, version: 1 }))
    api.set(`GET /guild/v1/guilds/${GUILD}/messages`, (route) => json(route, 200, { items: [], next_cursor: null }))
  })

  test('authenticates first, merges ack and broadcast once, renegotiates on drop, stops on 4403', async ({ page, api }) => {
    const tickets: string[] = []
    api.set('POST /gateway/v1/ws-negotiate', (route) => {
      expect(route.request().postDataJSON()).toEqual({ resource: 'guild.chat', resource_id: GUILD })
      const ticket = `01a12000-0000-7000-8000-${String(tickets.length + 1).padStart(12, '0')}`
      tickets.push(ticket)
      return json(route, 200, { url: `ws://localhost:13004/v1/guilds/${GUILD}/chat`, ticket, expires_at: new Date(Date.now() + 30_000).toISOString() })
    })
    // Behaviour-based mock (dev StrictMode may open and close an extra first socket).
    const firstFrames: { type: string; ticket: string }[] = []
    let dropped = false
    await page.routeWebSocket(`ws://localhost:13004/v1/guilds/${GUILD}/chat`, (ws) => {
      let first = true
      ws.onMessage((raw) => {
        const frame = JSON.parse(String(raw))
        if (first) {
          firstFrames.push(frame)
          first = false
          ws.send(JSON.stringify({ type: 'ready', guild_id: GUILD, user_id: ME.user_id, expires_at: new Date(Date.now() + 3_600_000).toISOString() }))
          if (dropped) setTimeout(() => ws.close({ code: 4403, reason: 'not a member' }), 300)
          return
        }
        if (frame.type === 'send') {
          const message = { message_id: '01a12000-0000-7000-8000-00000000e001', guild_id: GUILD, author_id: ME.user_id, client_message_id: frame.client_message_id, content: frame.content, timestamp: new Date().toISOString() }
          ws.send(JSON.stringify({ type: 'message', message }))
          ws.send(JSON.stringify({ type: 'ack', client_message_id: frame.client_message_id, message_id: message.message_id, timestamp: message.timestamp }))
          setTimeout(() => {
            dropped = true
            ws.close({ code: 1011, reason: 'restart' })
          }, 200)
        }
      })
    })

    await signIn(page, api, `/guilds/${GUILD}/chat`)
    await expect(page.getByRole('status').filter({ hasText: 'Live' })).toBeVisible()
    await page.getByRole('textbox', { name: 'Message' }).fill('Hello hollow')
    await page.getByRole('button', { name: 'Send message' }).click()
    await expect(page.getByRole('log').getByText('Hello hollow')).toHaveCount(1)
    await expect(page.getByText('You are not a member of this guild.')).toBeVisible({ timeout: 10_000 })

    // Every connection authenticated first with its own freshly negotiated ticket.
    expect(firstFrames.every((frame) => frame.type === 'auth')).toBe(true)
    expect(new Set(firstFrames.map((frame) => frame.ticket)).size).toBe(firstFrames.length)
    expect(tickets.slice(-firstFrames.length)).toEqual(firstFrames.map((frame) => frame.ticket))
    // A membership refusal is final: no further negotiation.
    const after = tickets.length
    await page.waitForTimeout(2500)
    expect(tickets).toHaveLength(after)
  })

  test('refuses a negotiated URL outside the allowed socket origins', async ({ page, api }) => {
    api.set('POST /gateway/v1/ws-negotiate', (route) =>
      json(route, 200, { url: `ws://evil.example.test/v1/guilds/${GUILD}/chat`, ticket: '01a12000-0000-7000-8000-000000000009', expires_at: new Date(Date.now() + 30_000).toISOString() }),
    )
    await signIn(page, api, `/guilds/${GUILD}/chat`)
    await expect(page.getByText('The chat server address is not allowed by this client configuration.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled()
  })
})
