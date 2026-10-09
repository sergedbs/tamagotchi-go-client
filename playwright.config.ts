import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

export default defineConfig({
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    // Chrome is the primary demo browser; uses the installed stable channel.
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // Identified browser network fixtures: every /api call must be fulfilled by the test.
      name: 'fixtures',
      testDir: './tests/e2e/fixtures',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      // Real Gateway through the dev proxy. Requires E2E_REAL_TARGET and explicit confirmation.
      name: 'real',
      testDir: './tests/e2e/real',
      workers: 1,
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 60_000,
      },
})
