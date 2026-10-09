import { parseTime } from '../../lib/time.ts'

export type BattleStatus = 'PENDING_ACCEPT' | 'PREPARING' | 'ONGOING' | 'COMPLETED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED'
export type DeliveryStatus = 'NOT_READY' | 'PENDING' | 'PARTIAL' | 'DELIVERED' | 'NOT_APPLICABLE' | 'NEEDS_ATTENTION'
export type AccessGrantStatus = 'NOT_READY' | 'PENDING' | 'GRANTED' | 'ALREADY_HOLDER' | 'CAP_COMPENSATED' | 'NOT_APPLICABLE' | 'NEEDS_ATTENTION'
export type RaidStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export const BATTLE_STATUS_LABEL: Record<BattleStatus, string> = {
  PENDING_ACCEPT: 'Waiting for the opponent',
  PREPARING: 'Preparing',
  ONGOING: 'In progress',
  COMPLETED: 'Finished',
  REJECTED: 'Declined',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
}

export const DELIVERY_LABEL: Record<DeliveryStatus, string> = {
  NOT_READY: 'Not started yet',
  PENDING: 'Being delivered',
  PARTIAL: 'Partly delivered',
  DELIVERED: 'Delivered',
  NOT_APPLICABLE: 'Nothing to deliver',
  NEEDS_ATTENTION: 'Needs attention from the operators',
}

export const ACCESS_GRANT_LABEL: Record<AccessGrantStatus, string> = {
  NOT_READY: 'Not started yet',
  PENDING: 'Being granted',
  GRANTED: 'Winner now shares the staked creature',
  ALREADY_HOLDER: 'Winner already held the staked creature',
  CAP_COMPENSATED: 'Holder limit reached; compensated instead',
  NOT_APPLICABLE: 'No creature changes hands',
  NEEDS_ATTENTION: 'Needs attention from the operators',
}

export const RAID_STATUS_LABEL: Record<RaidStatus, string> = {
  ACTIVE: 'In progress',
  COMPLETED: 'Boss defeated',
  FAILED: 'Time ran out',
  CANCELLED: 'Cancelled',
}

export function battleIsTerminal(status: BattleStatus): boolean {
  return status === 'COMPLETED' || status === 'REJECTED' || status === 'EXPIRED' || status === 'CANCELLED'
}

/** Delivery is still moving and worth a bounded poll. */
export function deliveryInFlight(status: DeliveryStatus | AccessGrantStatus): boolean {
  return status === 'NOT_READY' || status === 'PENDING'
}

/** Reward semantics differ by outcome; cancellations never pay out. */
export function raidRewardMeaning(status: RaidStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'Victory rewards go to admitted participants.'
    case 'FAILED':
      return 'Defeat rewards apply only if this boss defines them.'
    case 'CANCELLED':
      return 'Cancelled raids pay no rewards.'
    case 'ACTIVE':
      return 'Rewards are settled after the raid ends.'
  }
}

export interface OccurrenceWindow {
  status: 'scheduled' | 'active' | 'inactive' | 'cancelled'
  available_from: string
  available_until: string
}

/** Available means active and inside its window right now; status alone is not enough. */
export function occurrenceAvailability(occurrence: OccurrenceWindow, now: number): 'available' | 'upcoming' | 'closed' {
  const from = parseTime(occurrence.available_from) ?? Infinity
  const until = parseTime(occurrence.available_until) ?? -Infinity
  if (occurrence.status === 'active' && from <= now && now < until) return 'available'
  if ((occurrence.status === 'scheduled' || occurrence.status === 'active') && now < from) return 'upcoming'
  return 'closed'
}
