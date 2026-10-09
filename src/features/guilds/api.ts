import { useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { useApi } from '../../api/apiContext.ts'
import { apiPath } from '../../api/http.ts'
import { LIST_LIMIT, readAll } from '../social/api.ts'

export const guildSchema = z.object({
  guild_id: z.string(),
  name: z.string(),
  description: z.string(),
  leader_id: z.string(),
  member_count: z.number().int(),
  version: z.number().int(),
})
export type Guild = z.output<typeof guildSchema>
const guildPageSchema = z.object({ items: z.array(guildSchema), next_cursor: z.string().nullable() })

export const memberSchema = z.object({ user_id: z.string(), role: z.enum(['LEADER', 'OFFICER', 'MEMBER']) })
export type Member = z.output<typeof memberSchema>
export const membersSchema = z.object({ guild_id: z.string(), members: z.array(memberSchema), version: z.number().int(), retrieved_at: z.string() })
export type Members = z.output<typeof membersSchema>

export const invitationSchema = z.object({
  invitation_id: z.string(),
  guild_id: z.string(),
  invited_user_id: z.string(),
  invited_by_user_id: z.string(),
  status: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED']),
  expires_at: z.string(),
})
export type Invitation = z.output<typeof invitationSchema>
const invitationPageSchema = z.object({ items: z.array(invitationSchema), next_cursor: z.string().nullable() })

export const ROLE_LABEL: Record<Member['role'], string> = { LEADER: 'Leader', OFFICER: 'Officer', MEMBER: 'Member' }

export const guildKeys = {
  list: (userId: string) => ['user', userId, 'guilds', { limit: LIST_LIMIT }] as const,
  guild: (userId: string, guildId: string) => ['user', userId, 'guild', guildId] as const,
  members: (userId: string, guildId: string) => ['user', userId, 'guild-members', guildId] as const,
  invitations: (userId: string) => ['user', userId, 'guild-invitations', { limit: LIST_LIMIT }] as const,
  messages: (userId: string, guildId: string) => ['user', userId, 'guild-messages', guildId, { limit: LIST_LIMIT }] as const,
}

export function useGuildList(userId: string) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: guildKeys.list(userId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) =>
      (await api.request({ method: 'GET', path: '/guild/v1/guilds', query: { limit: LIST_LIMIT, cursor: pageParam }, auth: 'user', parse: (value) => guildPageSchema.parse(value), signal })).data,
    getNextPageParam: (last) => last.next_cursor,
  })
}

export function useGuild(userId: string, guildId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: guildKeys.guild(userId, guildId ?? 'none'),
    enabled: !!guildId,
    queryFn: async ({ signal }) => (await api.request({ method: 'GET', path: apiPath`/guild/v1/guilds/${guildId!}`, auth: 'user', parse: (value) => guildSchema.parse(value), signal })).data,
  })
}

/** Roster for one selected guild only; never fetched for every guild in a list. */
export function useMembers(userId: string, guildId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: guildKeys.members(userId, guildId ?? 'none'),
    staleTime: 0,
    enabled: !!guildId,
    queryFn: async ({ signal }) => (await api.request({ method: 'GET', path: apiPath`/guild/v1/guilds/${guildId!}/members`, auth: 'user', parse: (value) => membersSchema.parse(value), signal })).data,
  })
}

export function useMyInvitations(userId: string) {
  const api = useApi()
  return useQuery({
    queryKey: guildKeys.invitations(userId),
    staleTime: 0,
    queryFn: ({ signal }) => readAll(api, '/guild/v1/invitations', (value) => invitationPageSchema.parse(value), signal),
  })
}

export function roleOf(members: Members | undefined, userId: string): Member['role'] | null {
  return members?.members.find((member) => member.user_id === userId)?.role ?? null
}

export function reconcileGuild(queryClient: QueryClient, userId: string, guildId: string) {
  void queryClient.invalidateQueries({ queryKey: guildKeys.guild(userId, guildId) })
  void queryClient.invalidateQueries({ queryKey: guildKeys.members(userId, guildId) })
  void queryClient.invalidateQueries({ queryKey: ['user', userId, 'guilds'] })
  void queryClient.invalidateQueries({ queryKey: ['user', userId, 'guild-invitations'] })
}
