import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tour of the app in a real browser. Unit tests (vitest) cover the
 * pure logic; this suite exists for what only a browser can tell us — that a
 * child can actually reach a task, answer it, and see the result, and that the
 * console stays clean while they do.
 *
 * Not part of `pnpm test`: it needs a downloaded browser, a proxy worker with
 * a seeded local R2, and a built app. In CI it is its own job, so none of that
 * sits in front of the typecheck result.
 */
const DEV_URL = process.env.OLYMP_E2E_URL ?? 'http://localhost:5173'
const PREVIEW_URL = 'http://localhost:4173'

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
    trace: 'retain-on-failure',
    // The audience is children on phones and tablets, so that is the shape
    // every screenshot is taken in.
    ...devices['iPhone 15'],
    isMobile: false,
    hasTouch: false,
  },
  projects: [
    {
      name: 'dev',
      testIgnore: /service-worker\.spec\.ts/,
      use: { browserName: 'chromium', baseURL: DEV_URL },
    },
    {
      // The service worker only exists in a build, so this one project runs
      // against `vite preview` instead of the dev server.
      name: 'build',
      testMatch: /service-worker\.spec\.ts/,
      use: { browserName: 'chromium', baseURL: PREVIEW_URL },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @olymp/pwa dev',
      url: DEV_URL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // Always rebuilt, never reused: a preview server left over from an
      // earlier build would serve a stale service worker, and the suite would
      // quietly test the version we are trying to replace.
      command: 'pnpm --filter @olymp/pwa build && pnpm --filter @olymp/pwa preview',
      url: PREVIEW_URL,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
})
