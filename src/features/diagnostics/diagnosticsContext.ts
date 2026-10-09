import { createContext, useContext, useSyncExternalStore } from 'react'
import type { ActivityRing } from './ring.ts'

/** Present only when public config enables diagnostics. */
export const DiagnosticsContext = createContext<ActivityRing | null>(null)

export function useDiagnosticsRing(): ActivityRing | null {
  return useContext(DiagnosticsContext)
}

const EMPTY: never[] = []
const noop = () => () => {}

export function useActivity() {
  const ring = useDiagnosticsRing()
  return useSyncExternalStore(ring?.subscribe ?? noop, ring?.snapshot ?? (() => EMPTY))
}
