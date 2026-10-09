import { useRef } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { useApi } from '../../../api/apiContext.ts'
import { apiPath } from '../../../api/http.ts'
import { LIST_LIMIT, readAll } from '../../social/api.ts'
import { battleIsTerminal, deliveryInFlight } from '../status.ts'

export const battleSideSchema = z.object({
  user_id: z.string(),
  primary_id: z.string(),
  secondary_id: z.string(),
  current_hp: z.number().int(),
  max_hp: z.number().int(),
})

export const battleSchema = z.object({
  battle_id: z.string(),
  challenger_id: z.string(),
  opponent_id: z.string(),
  status: z.enum(['PENDING_ACCEPT', 'PREPARING', 'ONGOING', 'COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED']),
  sides: z.array(battleSideSchema),
  turn_user_id: z.string().nullable(),
  turn_expires_at: z.string().nullable(),
  expires_at: z.string(),
  winner_id: z.string().nullable(),
  loser_id: z.string().nullable(),
  settlement_status: z.enum(['NOT_READY', 'PENDING', 'PARTIAL', 'DELIVERED', 'NOT_APPLICABLE', 'NEEDS_ATTENTION']),
  access_grant_status: z.enum(['NOT_READY', 'PENDING', 'GRANTED', 'ALREADY_HOLDER', 'CAP_COMPENSATED', 'NOT_APPLICABLE', 'NEEDS_ATTENTION']),
  engagement_id: z.string().nullable(),
  version: z.number().int(),
})
export type Battle = z.output<typeof battleSchema>
const battlePageSchema = z.object({ items: z.array(battleSchema), next_cursor: z.string().nullable() })

export const battleAttackSchema = z.object({
  battle_id: z.string(),
  attacker_id: z.string(),
  damage_dealt: z.number().int(),
  opponent_hp_remaining: z.number().int(),
  next_turn: z.string().nullable(),
  status: z.enum(['ONGOING', 'COMPLETED']),
  version: z.number().int(),
})
export type BattleAttack = z.output<typeof battleAttackSchema>

const boostSchema = z.object({ boost_id: z.literal('ATTACK_10'), charges: z.number().int(), attack_bps: z.number().int() })
export type Boost = z.output<typeof boostSchema>
const boostPageSchema = z.object({ items: z.array(boostSchema), next_cursor: z.string().nullable() })

export const POLL_MS = 2000
/** After completion, settlement is polled for a bounded window, then checked manually. */
export const SETTLEMENT_WINDOW_MS = 60_000

export const battleKeys = {
  list: (userId: string) => ['user', userId, 'battles', { limit: LIST_LIMIT }] as const,
  battle: (userId: string, battleId: string) => ['user', userId, 'battle', battleId] as const,
  boosts: (userId: string) => ['user', userId, 'boosts'] as const,
}

export function useBattleList(userId: string) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: battleKeys.list(userId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) =>
      (await api.request({ method: 'GET', path: '/battle/v1/battles', query: { limit: LIST_LIMIT, cursor: pageParam }, auth: 'user', parse: (value) => battlePageSchema.parse(value), signal })).data,
    getNextPageParam: (last) => last.next_cursor,
    staleTime: 0,
  })
}

/** Polls every 2 s only while visible and not terminal; delivery gets a bounded window. */
export function useBattle(userId: string, battleId: string) {
  const api = useApi()
  const settlingSince = useRef<number | null>(null)
  return useQuery({
    queryKey: battleKeys.battle(userId, battleId),
    queryFn: async ({ signal }) =>
      (await api.request({ method: 'GET', path: apiPath`/battle/v1/battles/${battleId}`, auth: 'user', parse: (value) => battleSchema.parse(value), signal })).data,
    refetchInterval: (query) => {
      const battle = query.state.data
      if (!battle) return false
      if (!battleIsTerminal(battle.status)) return POLL_MS
      if (battle.status === 'COMPLETED') settlingSince.current ??= Date.now()
      const delivering = deliveryInFlight(battle.settlement_status) || deliveryInFlight(battle.access_grant_status)
      if (battle.status === 'COMPLETED' && delivering && settlingSince.current !== null && Date.now() - settlingSince.current < SETTLEMENT_WINDOW_MS) return POLL_MS
      return false
    },
    refetchIntervalInBackground: false,
  })
}

export function useBoosts(userId: string) {
  const api = useApi()
  return useQuery({
    queryKey: battleKeys.boosts(userId),
    queryFn: ({ signal }) => readAll(api, '/users/v1/users/me/boosts', (value) => boostPageSchema.parse(value), signal),
  })
}
