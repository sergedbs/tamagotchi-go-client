import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { useApi } from '../../api/apiContext.ts'
import { apiPath } from '../../api/http.ts'
import { withEtag } from '../creatures/api.ts'
import { LIST_LIMIT, readAll } from '../social/api.ts'

export const NOTIFICATION_TYPES = ['FRIEND_REQUEST', 'PLAYER_NEARBY', 'BATTLE_REQUEST', 'TAMAGOTCHI_SHARED', 'GUILD_INVITATION', 'RAID_STARTED'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const notificationSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  // Unknown future types and statuses stay readable through neutral wording.
  type: z.string(),
  event_id: z.string(),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  created_at: z.string(),
  read_at: z.string().nullable(),
  delivery_status: z.string(),
})
export type AppNotification = z.output<typeof notificationSchema>
const notificationPageSchema = z.object({ items: z.array(notificationSchema), next_cursor: z.string().nullable() })

export const readAllReceiptSchema = z.object({ updated_count: z.number().int() })
export type ReadAllReceipt = z.output<typeof readAllReceiptSchema>

export const preferencesSchema = z.object({ muted_categories: z.array(z.enum(NOTIFICATION_TYPES)), version: z.number().int() })
export type Preferences = z.output<typeof preferencesSchema>

export const deviceSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  platform: z.enum(['ANDROID', 'IOS', 'WEB']),
  package_id: z.string(),
  locale: z.string(),
  registered_at: z.string(),
})
export type Device = z.output<typeof deviceSchema>
const devicePageSchema = z.object({ items: z.array(deviceSchema), next_cursor: z.string().nullable() })

/** The inbox refreshes every 15 s, only while its screen and the document are visible. */
export const INBOX_POLL_MS = 15_000

export const notificationKeys = {
  inbox: (userId: string) => ['user', userId, 'notifications', { limit: LIST_LIMIT }] as const,
  preferences: (userId: string) => ['user', userId, 'notification-preferences'] as const,
  devices: (userId: string) => ['user', userId, 'devices', { limit: LIST_LIMIT }] as const,
}

export function useInbox(userId: string, options: { poll?: boolean } = {}) {
  const api = useApi()
  return useInfiniteQuery({
    queryKey: notificationKeys.inbox(userId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) =>
      (
        await api.request({
          method: 'GET',
          path: apiPath`/notification/v1/users/${userId}/notifications`,
          query: { limit: LIST_LIMIT, cursor: pageParam },
          auth: 'user',
          parse: (value) => notificationPageSchema.parse(value),
          signal,
        })
      ).data,
    getNextPageParam: (last) => last.next_cursor,
    refetchInterval: options.poll ? INBOX_POLL_MS : false,
    refetchIntervalInBackground: false,
  })
}

export function usePreferences(userId: string) {
  const api = useApi()
  return useQuery({
    queryKey: notificationKeys.preferences(userId),
    staleTime: 0,
    queryFn: async ({ signal }) =>
      withEtag(await api.request({ method: 'GET', path: apiPath`/notification/v1/users/${userId}/preferences`, auth: 'user', parse: (value) => preferencesSchema.parse(value), signal })),
  })
}

export function useDevices(userId: string) {
  const api = useApi()
  return useQuery({
    queryKey: notificationKeys.devices(userId),
    queryFn: ({ signal }) => readAll(api, '/notification/v1/devices', (value) => devicePageSchema.parse(value), signal),
  })
}
