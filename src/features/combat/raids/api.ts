import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { useApi } from '../../../api/apiContext.ts'
import { ApiError } from '../../../api/errors.ts'
import { apiPath, type ApiClient } from '../../../api/http.ts'
import { COMBAT_TYPES } from '../../creatures/dto.ts'
import { LIST_LIMIT, readAll } from '../../social/api.ts'
import { POLL_MS } from '../battles/api.ts'

const combatType = z.enum(COMBAT_TYPES)

export const raidSchema = z.object({
  raid_id: z.string(),
  guild_id: z.string(),
  boss_id: z.string(),
  occurrence_id: z.string(),
  boss: z.object({ name: z.string(), max_hp: z.number().int(), current_hp: z.number().int(), weaknesses: z.array(combatType), resistances: z.array(combatType) }),
  status: z.enum(['ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED']),
  started_at: z.string(),
  expires_at: z.string(),
  ended_at: z.string().nullable(),
  max_participants: z.number().int(),
  participant_count: z.number().int(),
  version: z.number().int(),
  reward_status: z.enum(['NOT_READY', 'PENDING', 'PARTIAL', 'DELIVERED', 'NOT_APPLICABLE', 'NEEDS_ATTENTION']),
})
export type Raid = z.output<typeof raidSchema>
const raidPageSchema = z.object({ items: z.array(raidSchema), next_cursor: z.string().nullable() })

export const raidAttackSchema = z.object({
  raid_id: z.string(),
  attacker_id: z.string(),
  damage_dealt: z.number().int(),
  boss_hp_remaining: z.number().int(),
  status: z.enum(['ACTIVE', 'COMPLETED']),
  raid_version: z.number().int(),
  accepted_at: z.string(),
  next_attack_at: z.string().nullable(),
})
export type RaidAttack = z.output<typeof raidAttackSchema>

const leaderboardSchema = z.object({
  raid_id: z.string(),
  items: z.array(z.object({ user_id: z.string(), tamagotchi_id: z.string(), damage_dealt: z.number().int(), joined_at: z.string() })),
  next_cursor: z.string().nullable(),
  retrieved_at: z.string(),
  raid_version: z.number().int(),
})
export type Leaderboard = z.output<typeof leaderboardSchema>

export const occurrenceSchema = z.object({
  occurrence_id: z.string(),
  boss_id: z.string(),
  boss_version: z.number().int(),
  available_from: z.string(),
  available_until: z.string(),
  status: z.enum(['scheduled', 'active', 'inactive', 'cancelled']),
  version: z.number().int(),
})
export type Occurrence = z.output<typeof occurrenceSchema>
const occurrencePageSchema = z.object({ items: z.array(occurrenceSchema), next_cursor: z.string().nullable() })

const reward = z.object({ global_currency: z.number().int(), xp: z.number().int() })
export const bossDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  sprite_ref: z.string(),
  combat_type: combatType,
  max_hp: z.number().int(),
  defense: z.number().int(),
  weaknesses: z.array(combatType),
  resistances: z.array(combatType),
  special_properties: z.object({}).passthrough(),
  duration_seconds: z.number().int(),
  max_participants: z.number().int(),
  rewards: reward,
  defeat_rewards: reward.nullable(),
})
export const bossSchema = z.object({ boss_id: z.string(), config_version: z.number().int(), definition: bossDefinitionSchema })
export type Boss = z.output<typeof bossSchema>

export const raidKeys = {
  raids: (userId: string, guildId: string | null) => ['user', userId, 'raids', { guild: guildId, limit: LIST_LIMIT }] as const,
  raid: (userId: string, raidId: string) => ['user', userId, 'raid', raidId] as const,
  leaderboard: (userId: string, raidId: string, version: number) => ['user', userId, 'leaderboard', raidId, { version, limit: LIST_LIMIT }] as const,
  occurrences: (userId: string) => ['user', userId, 'occurrences', { limit: LIST_LIMIT }] as const,
  occurrence: (userId: string, id: string) => ['user', userId, 'occurrence', id] as const,
  boss: (userId: string, bossId: string, version: number) => ['user', userId, 'boss', bossId, version] as const,
}

export function useOccurrences(userId: string) {
  const api = useApi()
  return useQuery({
    queryKey: raidKeys.occurrences(userId),
    queryFn: ({ signal }) => readAll(api, '/registry/v1/raid-occurrences', (value) => occurrencePageSchema.parse(value), signal),
  })
}

export function useOccurrence(userId: string, occurrenceId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: raidKeys.occurrence(userId, occurrenceId ?? 'none'),
    enabled: !!occurrenceId,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) =>
      (await api.request({ method: 'GET', path: apiPath`/registry/v1/raid-occurrences/${occurrenceId!}`, auth: 'user', parse: (value) => occurrenceSchema.parse(value), signal })).data,
  })
}

/** The pinned boss configuration version, never the current definition. */
export function useBoss(userId: string, bossId: string | undefined, version: number | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: raidKeys.boss(userId, bossId ?? 'none', version ?? 0),
    enabled: !!bossId && !!version,
    staleTime: Infinity,
    queryFn: async ({ signal }) =>
      (
        await api.request({
          method: 'GET',
          path: apiPath`/registry/v1/bosses/${bossId!}`,
          query: { config_version: version },
          auth: 'user',
          parse: (value) => bossSchema.parse(value),
          signal,
        })
      ).data,
  })
}

export function useRaids(userId: string, guildId: string | null) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: raidKeys.raids(userId, guildId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) =>
      (
        await api.request({
          method: 'GET',
          path: '/raid/v1/raids',
          query: { guild_id: guildId, limit: LIST_LIMIT, cursor: pageParam },
          auth: 'user',
          parse: (value) => raidPageSchema.parse(value),
          signal,
        })
      ).data,
    getNextPageParam: (last) => last.next_cursor,
    staleTime: 0,
  })
}

/** Active raid detail polls every 2 s while visible; polling stops at a terminal status. */
export function useRaid(userId: string, raidId: string) {
  const api = useApi()
  return useQuery({
    queryKey: raidKeys.raid(userId, raidId),
    queryFn: async ({ signal }) =>
      (await api.request({ method: 'GET', path: apiPath`/raid/v1/raids/${raidId}`, auth: 'user', parse: (value) => raidSchema.parse(value), signal })).data,
    refetchInterval: (query) => (query.state.data?.status === 'ACTIVE' ? POLL_MS : false),
    refetchIntervalInBackground: false,
  })
}

/** Leaderboard bound to one raid_version: a version change re-reads from page one. */
export async function fetchLeaderboardPage(api: ApiClient, raidId: string, cursor: string | null, signal?: AbortSignal): Promise<Leaderboard> {
  return (
    await api.request({
      method: 'GET',
      path: apiPath`/raid/v1/raids/${raidId}/leaderboard`,
      query: { limit: LIST_LIMIT, cursor },
      auth: 'user',
      parse: (value) => leaderboardSchema.parse(value),
      signal,
    })
  ).data
}

export function useLeaderboard(userId: string, raidId: string, version: number) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: raidKeys.leaderboard(userId, raidId, version),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => fetchLeaderboardPage(api, raidId, pageParam, signal),
    getNextPageParam: (last) => last.next_cursor,
    staleTime: Infinity,
    retry: (count, error) => count < 1 && error instanceof ApiError && error.code === 'cursor_stale',
  })
}
