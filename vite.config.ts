/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { apiProxy, resolveGatewayUpstream } from './scripts/apiProxy.ts'

export default defineConfig(({ mode }) => {
  // Server-side setting only; never exposed through import.meta.env.
  const env = loadEnv(mode, process.cwd(), '')
  const upstream = resolveGatewayUpstream(process.env.GATEWAY_UPSTREAM ?? env.GATEWAY_UPSTREAM)
  const proxy = apiProxy(upstream)

  return {
    plugins: [react()],
    server: { host: 'localhost', port: 5173, strictPort: true, proxy },
    preview: { host: 'localhost', port: 4173, strictPort: true, proxy },
    build: { sourcemap: true },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
      restoreMocks: true,
      // Token tests read the raw stylesheet; other CSS stays unprocessed.
      css: { include: [/tokens\.css/] },
      coverage: {
        provider: 'v8',
        include: ['src/api/**', 'src/app/config.ts', 'src/packages/**/*.ts'],
        exclude: ['**/*.test.*'],
        thresholds: { lines: 80 },
      },
    },
  }
})
