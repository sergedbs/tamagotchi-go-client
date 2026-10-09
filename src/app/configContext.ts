import { createContext, useContext } from 'react'
import type { ClientConfig } from './config.ts'

export const ConfigContext = createContext<ClientConfig | null>(null)

export function useConfig(): ClientConfig {
  const config = useContext(ConfigContext)
  if (!config) throw new Error('useConfig must be used inside ConfigContext')
  return config
}
