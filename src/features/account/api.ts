import { useQueries, useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { useApi } from '../../api/apiContext.ts'
import { apiPath } from '../../api/http.ts'

export const walletSchema = z.object({ user_id: z.string(), package_id: z.string().nullable(), amount: z.number().int() })
export type Wallet = z.output<typeof walletSchema>

export const walletKeys = {
  all: (userId: string) => ['user', userId, 'wallet'] as const,
  global: (userId: string) => ['user', userId, 'wallet', 'global'] as const,
  local: (userId: string, packageId: string) => ['user', userId, 'wallet', 'local', packageId] as const,
}

/** Wallets are server balances; the client never adds currency itself. */
export function useGlobalWallet(userId: string) {
  const api = useApi()
  return useQuery({
    queryKey: walletKeys.global(userId),
    staleTime: 0,
    queryFn: async ({ signal }) =>
      (await api.request({ method: 'GET', path: apiPath`/users/v1/users/${userId}/currency/global`, auth: 'user', parse: (value) => walletSchema.parse(value), signal })).data,
  })
}

export function useLocalWallets(userId: string, packageIds: string[]) {
  const api = useApi()
  return useQueries({
    queries: packageIds.map((packageId) => ({
      queryKey: walletKeys.local(userId, packageId),
      staleTime: 0,
      queryFn: async ({ signal }: { signal: AbortSignal }) =>
        (await api.request({ method: 'GET', path: apiPath`/users/v1/users/${userId}/currency/local/${packageId}`, auth: 'user', parse: (value) => walletSchema.parse(value), signal })).data,
    })),
  })
}
