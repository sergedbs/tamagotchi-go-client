import { describe, expect, it } from 'vitest'
import { deliveryLabel, presentNotification } from './templates.ts'

const NOW = Date.parse('2026-10-09T10:00:00.000Z')
const ID = '01a12000-0000-7000-8000-00000000b001'
const later = '2026-10-09T12:00:00.000Z'

describe('presentNotification', () => {
  it('renders the six documented templates with validated destinations', () => {
    expect(presentNotification({ type: 'FRIEND_REQUEST', params: { request_id: ID, from_user_id: ID, from_username: 'leon', expires_at: later } }, NOW)).toEqual({
      kind: 'FRIEND_REQUEST',
      title: 'leon wants to be friends',
      detail: 'Expires in 2 hours',
      href: '/social',
      linkLabel: 'Review requests',
    })
    expect(presentNotification({ type: 'PLAYER_NEARBY', params: { with_user_id: ID, distance_m: 120.4, encounter_id: ID } }, NOW)).toMatchObject({ detail: 'About 120 m away', href: `/players/${ID}` })
    expect(presentNotification({ type: 'BATTLE_REQUEST', params: { battle_id: ID, challenger_id: ID, challenger_username: 'leon', expires_at: later } }, NOW)).toMatchObject({
      title: 'leon challenged you to a battle',
      href: `/combat/battles/${ID}`,
    })
    expect(presentNotification({ type: 'TAMAGOTCHI_SHARED', params: { tamagotchi_id: ID, tamagotchi_name: 'Ripple', combat_type: 'WATER', level: 3 } }, NOW)).toMatchObject({
      title: 'Ripple was shared with you',
      detail: 'Level 3 · Water',
      href: `/creatures/${ID}`,
    })
    expect(presentNotification({ type: 'GUILD_INVITATION', params: { guild_id: ID, guild_name: 'Moss Hollow', invitation_id: ID, expires_at: later } }, NOW)).toMatchObject({
      title: 'You are invited to join Moss Hollow',
      href: `/guilds/${ID}`,
    })
    expect(presentNotification({ type: 'RAID_STARTED', params: { raid_id: ID, guild_id: ID, boss_name: 'Cinder Gryfon', started_at: later, expires_at: '2026-10-09T09:00:00.000Z' } }, NOW)).toMatchObject({
      title: 'A raid on Cinder Gryfon has started',
      detail: 'Ended',
      href: `/combat/raids/${ID}`,
    })
  })

  it('falls back to neutral wording and the owning list for missing or invalid values', () => {
    expect(presentNotification({ type: 'BATTLE_REQUEST', params: { battle_id: '../admin', challenger_username: 42 } }, NOW)).toMatchObject({ title: 'New battle challenge', detail: null, href: '/combat/battles' })
    expect(presentNotification({ type: 'PLAYER_NEARBY', params: { with_user_id: 'javascript:alert(1)', distance_m: 'near' } }, NOW)).toMatchObject({ detail: null, href: '/explore' })
    expect(presentNotification({ type: 'TAMAGOTCHI_SHARED', params: { combat_type: 'LAVA', level: 2.5 } }, NOW)).toMatchObject({ title: 'A creature was shared with you', detail: null, href: '/creatures' })
    expect(presentNotification({ type: 'GUILD_INVITATION', params: { guild_name: '   ', expires_at: 'soon' } }, NOW)).toMatchObject({ title: 'New guild invitation', detail: null, href: '/guilds' })
  })

  it('keeps an unknown future type readable without a link', () => {
    expect(presentNotification({ type: 'SEASON_STARTED', params: { anything: true } }, NOW)).toEqual({ kind: 'OTHER', title: 'New notification', detail: null, href: null, linkLabel: null })
  })

  it('bounds display names and never trusts them as markup', () => {
    const view = presentNotification({ type: 'FRIEND_REQUEST', params: { from_username: `<b>${'x'.repeat(100)}</b>` } }, NOW)
    expect(view.title.startsWith('<b>x')).toBe(true)
    expect(view.title.length).toBeLessThanOrEqual(64 + ' wants to be friends'.length)
  })
})

describe('deliveryLabel', () => {
  it('keeps provider statuses distinct and hides the inbox-only case', () => {
    expect(deliveryLabel('ACCEPTED_BY_PROVIDER')).toBe('Handed to the push provider')
    expect(deliveryLabel('NO_DEVICE')).toBeNull()
    expect(deliveryLabel('FAILED')).toBe('Push failed')
    expect(deliveryLabel('SOMETHING_NEW')).toBeNull()
  })
})
