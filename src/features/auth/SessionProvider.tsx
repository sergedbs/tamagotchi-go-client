import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiContext } from '../../api/apiContext.ts'
import { createApiClient } from '../../api/http.ts'
import { useConfig } from '../../app/configContext.ts'
import { SessionStore } from './session.ts'
import { SessionContext } from './sessionContext.ts'

/**
 * Owns the in-memory session and API client. Any identity change (logout, expiry,
 * another account) drops every cached query so data never crosses accounts.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const config = useConfig()
  const queryClient = useQueryClient()
  const store = useMemo(() => new SessionStore({ baseUrl: config.api_base }), [config.api_base])
  const api = useMemo(() => createApiClient({ baseUrl: config.api_base, session: store }), [config.api_base, store])
  const identity = useRef<string | null>(null)

  useEffect(
    () =>
      store.subscribe(() => {
        const state = store.getSnapshot()
        const next = state.status === 'authenticated' ? state.user.user_id : null
        if (next !== identity.current) {
          identity.current = next
          void queryClient.cancelQueries()
          queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'public' && query.queryKey[0] !== 'static' })
          queryClient.getMutationCache().clear()
        }
      }),
    [store, queryClient],
  )

  return (
    <SessionContext value={store}>
      <ApiContext value={api}>{children}</ApiContext>
    </SessionContext>
  )
}
