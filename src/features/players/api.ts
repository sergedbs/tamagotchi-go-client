import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { useApi } from '../../api/apiContext.ts'
import { apiPath } from '../../api/http.ts'
import { isUuid } from '../../api/uuid.ts'
import { useAuthenticated } from '../auth/sessionContext.ts'

export const userProfileSchema = z.object({ user_id: z.string(), username: z.string() })
export type UserProfile = z.output<typeof userProfileSchema>

/** Public profile by id, fetched on demand and cached briefly. */
export function useProfile(userId: string | null | undefined) {
  const api = useApi()
  const { user } = useAuthenticated()
  return useQuery({
    queryKey: ['user', user.user_id, 'profile', userId],
    enabled: isUuid(userId),
    staleTime: 60_000,
    queryFn: async ({ signal }) =>
      (
        await api.request({
          method: 'GET',
          path: apiPath`/users/v1/users/${userId!}`,
          auth: 'user',
          parse: (value) => userProfileSchema.parse(value),
          signal,
        })
      ).data,
  })
}
