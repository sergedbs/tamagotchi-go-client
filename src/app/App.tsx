import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router'
import type { ClientConfig } from './config.ts'
import { ConfigContext } from './configContext.ts'
import { createQueryClient } from './queryClient.ts'
import { AppRoutes } from './routes.tsx'
import { SessionProvider } from '../features/auth/SessionProvider.tsx'

export function App({ config }: { config: ClientConfig }) {
  const [queryClient] = useState(createQueryClient)
  return (
    <ConfigContext value={config}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </SessionProvider>
      </QueryClientProvider>
    </ConfigContext>
  )
}
