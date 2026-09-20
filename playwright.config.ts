import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tour of the app in a real browser. Unit tests (vitest) cover the
 * pure logic; this suite exists for what only a browser can tell us — that a
 * child can actually reach a task, answer it, and see the result, and that the
 * console stays clean while they do.
 *
 * Not part of `pnpm test`: it needs a downloaded browser and a running dev
 * server, neither of which belongs in the CI check job today.
 */
const BASE_URL = process.env.OLYMP_E2E_URL ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.artifacts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    // The audience is children on phones and tablets, so that is the shape
    // every screenshot is taken in.
    ...devices['iPhone 15'],
    isMobile: false,
    hasTouch: false,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'pnpm --filter @olymp/pwa dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
