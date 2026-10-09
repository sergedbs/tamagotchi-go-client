import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App.tsx'
import { ConfigErrorScreen } from './app/ConfigErrorScreen.tsx'
import { loadClientConfig } from './app/config.ts'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')
const root = createRoot(container)

loadClientConfig().then(
  (config) => {
    root.render(
      <StrictMode>
        <App config={config} />
      </StrictMode>,
    )
  },
  (error: unknown) => {
    root.render(<ConfigErrorScreen error={error} />)
  },
)
