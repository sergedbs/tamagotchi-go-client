import { isUuid } from '../../api/uuid.ts'
import { typeLabel } from '../../components/typeLabel.ts'
import { formatRelative, parseTime } from '../../lib/time.ts'
import { COMBAT_TYPES, type CombatType } from '../creatures/dto.ts'
import { formatDistance } from '../explore/geo.ts'
import type { NotificationType } from './api.ts'

type Params = Record<string, string | number | boolean>

export interface NotificationView {
  kind: NotificationType | 'OTHER'
  title: string
  detail: string | null
  /** A validated in-app destination; null when there is nothing to open. */
  href: string | null
  linkLabel: string | null
}

const NAME_MAX = 64

/** Display text only: trimmed, bounded, never markup or authority. */
function text(params: Params, key: string): string | null {
  const value = params[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, NAME_MAX) : null
}

function id(params: Params, key: string): string | null {
  const value = params[key]
  return typeof value === 'string' && isUuid(value) ? value.toLowerCase() : null
}

function num(params: Params, key: string): number | null {
  const value = params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function expiry(params: Params, now: number, verb = 'Expires'): string | null {
  const value = text(params, 'expires_at')
  if (parseTime(value) === null) return null
  return parseTime(value)! > now ? `${verb} ${formatRelative(value, now)}` : verb === 'Expires' ? 'Expired' : 'Ended'
}

function combatType(params: Params): CombatType | null {
  const value = params.combat_type
  return typeof value === 'string' && (COMBAT_TYPES as readonly string[]).includes(value) ? (value as CombatType) : null
}

/**
 * The six documented templates, built only from validated parameters. Missing or
 * invalid values give neutral wording and the owning list, never a forged route.
 */
export function presentNotification(notification: { type: string; params: Params }, now: number): NotificationView {
  const params = notification.params
  switch (notification.type) {
    case 'FRIEND_REQUEST': {
      const name = text(params, 'from_username')
      return { kind: 'FRIEND_REQUEST', title: name ? `${name} wants to be friends` : 'New friend request', detail: expiry(params, now), href: '/social', linkLabel: 'Review requests' }
    }
    case 'PLAYER_NEARBY': {
      const player = id(params, 'with_user_id')
      const distance = num(params, 'distance_m')
      return {
        kind: 'PLAYER_NEARBY',
        title: 'A player was nearby',
        detail: distance !== null && distance >= 0 ? `About ${formatDistance(distance)} away` : null,
        href: player ? `/players/${player}` : '/explore',
        linkLabel: player ? 'View player' : 'Open Explore',
      }
    }
    case 'BATTLE_REQUEST': {
      const name = text(params, 'challenger_username')
      const battle = id(params, 'battle_id')
      return {
        kind: 'BATTLE_REQUEST',
        title: name ? `${name} challenged you to a battle` : 'New battle challenge',
        detail: expiry(params, now),
        href: battle ? `/combat/battles/${battle}` : '/combat/battles',
        linkLabel: battle ? 'Open battle' : 'Open battles',
      }
    }
    case 'TAMAGOTCHI_SHARED': {
      const name = text(params, 'tamagotchi_name')
      const creature = id(params, 'tamagotchi_id')
      const level = num(params, 'level')
      const type = combatType(params)
      const facts = [level !== null && Number.isInteger(level) ? `Level ${level}` : null, type ? typeLabel(type) : null].filter(Boolean)
      return {
        kind: 'TAMAGOTCHI_SHARED',
        title: name ? `${name} was shared with you` : 'A creature was shared with you',
        detail: facts.length > 0 ? facts.join(' · ') : null,
        href: creature ? `/creatures/${creature}` : '/creatures',
        linkLabel: creature ? 'Open creature' : 'Open creatures',
      }
    }
    case 'GUILD_INVITATION': {
      const name = text(params, 'guild_name')
      const guild = id(params, 'guild_id')
      return {
        kind: 'GUILD_INVITATION',
        title: name ? `You are invited to join ${name}` : 'New guild invitation',
        detail: expiry(params, now),
        href: guild ? `/guilds/${guild}` : '/guilds',
        linkLabel: guild ? 'Open guild' : 'Open guilds',
      }
    }
    case 'RAID_STARTED': {
      const boss = text(params, 'boss_name')
      const raid = id(params, 'raid_id')
      return {
        kind: 'RAID_STARTED',
        title: boss ? `A raid on ${boss} has started` : 'A guild raid has started',
        detail: expiry(params, now, 'Ends'),
        href: raid ? `/combat/raids/${raid}` : '/combat/raids',
        linkLabel: raid ? 'Open raid' : 'Open raids',
      }
    }
    default:
      return { kind: 'OTHER', title: 'New notification', detail: null, href: null, linkLabel: null }
  }
}

const DELIVERY: Record<string, string | null> = {
  PENDING: 'Push pending',
  ACCEPTED_BY_PROVIDER: 'Handed to the push provider',
  SUPPRESSED: 'Push muted by your preferences',
  // Inbox-only users have no device; that is not an error.
  NO_DEVICE: null,
  EXPIRED: 'Push expired',
  FAILED: 'Push failed',
}

/** Delivery diagnostics as a quiet label; provider acceptance is not device receipt. */
export function deliveryLabel(status: string): string | null {
  return status in DELIVERY ? DELIVERY[status]! : null
}

export const CATEGORY_LABEL: Record<NotificationType, string> = {
  FRIEND_REQUEST: 'Friend requests',
  PLAYER_NEARBY: 'Nearby players',
  BATTLE_REQUEST: 'Battle challenges',
  TAMAGOTCHI_SHARED: 'Shared creatures',
  GUILD_INVITATION: 'Guild invitations',
  RAID_STARTED: 'Raid starts',
}
