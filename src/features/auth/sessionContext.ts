import { createContext, useContext, useSyncExternalStore } from 'react'
import type { SessionState, SessionStore } from './session.ts'

export const SessionContext = createContext<SessionStore | null>(null)

export function useSessionStore(): SessionStore {
  const store = useContext(SessionContext)
  if (!store) throw new Error('useSessionStore must be used inside SessionContext')
  return store
}

export function useSession(): SessionState {
  const store = useSessionStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

/** For screens behind RequireSession: the signed-in identity from /users/me. */
export function useAuthenticated() {
  const session = useSession()
  if (session.status !== 'authenticated') throw new Error('useAuthenticated used without a session')
  return session
}
