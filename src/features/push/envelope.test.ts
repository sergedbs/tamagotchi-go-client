import { describe, expect, it } from 'vitest'
import { inAppPath, parsePushData, pushView } from './envelope.ts'

const NOTIFICATION = '01a15000-0000-7000-8000-00000000a001'
const BATTLE = '01a15000-0000-7000-8000-00000000b001'
const NOW = Date.parse('2026-10-09T12:00:00Z')

const data = (type: string, params: Record<string, unknown>, overrides: Record<string, unknown> = {}) => ({
  type,
  notification_id: NOTIFICATION,
  params: JSON.stringify(params),
  ...overrides,
})

describe('parsePushData', () => {
  it('validates the documented envelope and decodes params', () => {
    expect(parsePushData(data('FRIEND_REQUEST', { from_username: 'mira', from_user_id: BATTLE }))).toEqual({
      type: 'FRIEND_REQUEST',
      notificationId: NOTIFICATION,
      params: { from_username: 'mira', from_user_id: BATTLE },
    })
  })

  it.each([
    ['no data', undefined],
    ['missing type', { notification_id: NOTIFICATION, params: '{}' }],
    ['non-UUID notification id', data('FRIEND_REQUEST', {}, { notification_id: 'abc' })],
    ['params not JSON', data('FRIEND_REQUEST', {}, { params: '{oops' })],
    ['params as an object, not a string', data('FRIEND_REQUEST', {}, { params: {} })],
    ['nested params', data('FRIEND_REQUEST', { from: { name: 'x' } })],
    ['array params', data('FRIEND_REQUEST', {}, { params: '[1,2]' })],
  ])('refuses %s', (_label, input) => {
    expect(parsePushData(input)).toBeNull()
  })
})

describe('pushView', () => {
  it('uses the inbox templates and a validated deep link', () => {
    const view = pushView(data('BATTLE_REQUEST', { challenger_username: 'theo', battle_id: BATTLE, expires_at: '2026-10-09T12:05:00Z' }), NOW)
    expect(view).toEqual({ title: 'theo challenged you to a battle', body: 'Expires in 5 minutes', href: `/combat/battles/${BATTLE}`, tag: NOTIFICATION })
  })

  it('falls back to the owning list when an ID is not valid', () => {
    expect(pushView(data('GUILD_INVITATION', { guild_name: 'Grove', guild_id: '../admin' }), NOW).href).toBe('/guilds')
  })

  it('keeps unknown types neutral and tagged', () => {
    expect(pushView(data('SOMETHING_NEW', { x: 1 }), NOW)).toEqual({ title: 'New notification', body: 'Tamagotchi Go', href: '/notifications', tag: NOTIFICATION })
  })

  it('shows a neutral notification for an invalid envelope', () => {
    expect(pushView({ type: 'FRIEND_REQUEST' }, NOW)).toEqual({ title: 'New notification', body: 'Tamagotchi Go', href: '/notifications', tag: undefined })
  })
})

describe('inAppPath', () => {
  it.each([
    ['/combat/raids', '/combat/raids'],
    ['/players/x?tab=1', '/players/x?tab=1'],
    ['//evil.example.test/x', '/notifications'],
    ['/\\evil.example.test', '/notifications'],
    ['https://evil.example.test/', '/notifications'],
    ['javascript:alert(1)', '/notifications'],
    [42, '/notifications'],
  ])('%s -> %s', (input, expected) => {
    expect(inAppPath(input)).toBe(expected)
  })
})
