import { describe, expect, it } from 'vitest'
import { chatReducer, initialChat, timeline, type PendingMessage } from './chatState.ts'
import { parseFrame, reconnectDelay, validateSocketUrl } from './protocol.ts'

const GUILD = '01a12000-0000-7000-8000-00000000aaaa'
const message = (id: string, client: string, ts: string, content = 'hi') => ({ message_id: id, guild_id: GUILD, author_id: 'me', client_message_id: client, content, timestamp: ts })
const pending = (client: string): PendingMessage => ({ client_message_id: client, content: 'hello', author_id: 'me', status: 'sending', created: 1 })

describe('chat reducer', () => {
  it('merges ack then broadcast into one bubble', () => {
    let state = chatReducer(initialChat, { type: 'sending', pending: pending('c1') })
    state = chatReducer(state, { type: 'ack', client_message_id: 'c1', message_id: 'm1', timestamp: '2026-10-09T12:00:00.000Z' })
    state = chatReducer(state, { type: 'message', message: message('m1', 'c1', '2026-10-09T12:00:00.000Z', 'hello') })
    expect(timeline(state).confirmed.map((m) => m.message_id)).toEqual(['m1'])
    expect(timeline(state).pending).toEqual([])
  })

  it('merges broadcast then ack into one bubble', () => {
    let state = chatReducer(initialChat, { type: 'sending', pending: pending('c1') })
    state = chatReducer(state, { type: 'message', message: message('m1', 'c1', '2026-10-09T12:00:00.000Z', 'hello') })
    state = chatReducer(state, { type: 'ack', client_message_id: 'c1', message_id: 'm1', timestamp: '2026-10-09T12:00:00.000Z' })
    expect(Object.keys(state.messages)).toEqual(['m1'])
    expect(state.pending).toEqual({})
  })

  it('de-duplicates history against live messages and orders by server time', () => {
    let state = chatReducer(initialChat, { type: 'message', message: message('m2', 'c2', '2026-10-09T12:00:02.000Z') })
    state = chatReducer(state, { type: 'history', items: [message('m2', 'c2', '2026-10-09T12:00:02.000Z'), message('m1', 'c1', '2026-10-09T12:00:01.000000Z')] })
    expect(timeline(state).confirmed.map((m) => m.message_id)).toEqual(['m1', 'm2'])
  })

  it('marks in-flight messages unconfirmed on disconnect and keeps failures', () => {
    let state = chatReducer(initialChat, { type: 'sending', pending: pending('c1') })
    state = chatReducer(state, { type: 'sending', pending: pending('c2') })
    state = chatReducer(state, { type: 'failed', client_message_id: 'c2', error: 'too_long' })
    state = chatReducer(state, { type: 'disconnected' })
    expect(state.pending.c1?.status).toBe('unconfirmed')
    expect(state.pending.c2?.status).toBe('failed')
  })

  it('does not resurrect a confirmed message as pending on retry', () => {
    let state = chatReducer(initialChat, { type: 'message', message: message('m1', 'c1', '2026-10-09T12:00:00.000Z') })
    state = chatReducer(state, { type: 'sending', pending: pending('c1') })
    expect(state.pending).toEqual({})
  })
})

describe('protocol', () => {
  it('parses known frames and ignores unknown ones', () => {
    expect(parseFrame(JSON.stringify({ type: 'ready', guild_id: GUILD, user_id: 'u', expires_at: '2026-10-09T13:00:00Z' }))?.type).toBe('ready')
    expect(parseFrame(JSON.stringify({ type: 'heartbeat' }))).toBeNull()
    expect(parseFrame('not json')).toBeNull()
  })

  it('validates negotiated socket URLs against configuration', () => {
    const allowed = ['ws://localhost:13004', 'wss://guild.example.test']
    expect(validateSocketUrl(`ws://localhost:13004/v1/guilds/${GUILD}/chat`, GUILD, allowed, 'http:')).toBe(`ws://localhost:13004/v1/guilds/${GUILD}/chat`)
    expect(validateSocketUrl(`ws://evil.example.test/v1/guilds/${GUILD}/chat`, GUILD, allowed, 'http:')).toBeNull()
    expect(validateSocketUrl(`ws://localhost:13004/v1/guilds/other/chat`, GUILD, allowed, 'http:')).toBeNull()
    expect(validateSocketUrl(`ws://localhost:13004/v1/guilds/${GUILD}/chat`, GUILD, allowed, 'https:')).toBeNull()
    expect(validateSocketUrl(`ws://localhost:13004/v1/guilds/${GUILD}/chat?ticket=x`, GUILD, allowed, 'http:')).toBeNull()
    expect(validateSocketUrl(`https://localhost:13004/v1/guilds/${GUILD}/chat`, GUILD, allowed, 'http:')).toBeNull()
  })

  it('bounds reconnect attempts to five with jitter', () => {
    expect([0, 1, 2, 3, 4].map((attempt) => reconnectDelay(attempt, () => 0))).toEqual([1000, 2000, 4000, 8000, 15000])
    expect(reconnectDelay(0, () => 1)).toBe(1300)
    expect(reconnectDelay(5)).toBeNull()
  })
})
