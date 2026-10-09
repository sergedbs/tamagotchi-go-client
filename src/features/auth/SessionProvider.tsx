import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiContext } from '../../api/apiContext.ts'
import { createApiClient } from '../../api/http.ts'
import { useConfig } from '../../app/configContext.ts'
import { DiagnosticsContext } from '../diagnostics/diagnosticsContext.ts'
import { ActivityRing } from '../diagnostics/ring.ts'
import { SessionStore } from './session.ts'
import { SessionContext } from './sessionContext.ts'

/**
 * Owns the in-memory session and API client. Any identity change (logout, expiry,
 * another account) drops every cached query so data never crosses accounts.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const config = useConfig()
  const queryClient = useQueryClient()
  // Diagnostics exist only when public config enables them; the ring lives in memory.
  const ring = useMemo(() => (config.diagnostics_enabled ? new ActivityRing() : null), [config.diagnostics_enabled])
  const store = useMemo(() => new SessionStore({ baseUrl: config.api_base, observe: ring?.record }), [config.api_base, ring])
  const api = useMemo(() => createApiClient({ baseUrl: config.api_base, session: store, observe: ring?.record }), [config.api_base, store, ring])
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
      <ApiContext value={api}>
        <DiagnosticsContext value={ring}>{children}</DiagnosticsContext>
      </ApiContext>
    </SessionContext>
  )
}
