import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, shot, start, test } from './app-fixtures.js'

/**
 * The service worker, against a real build served by `vite preview`.
 *
 * `registerType: 'prompt'` means a new build waits to be accepted. For a while
 * nothing accepted it: the registration script had no `onNeedRefresh`
 * listener, so an installed app would have served its first cached version
 * forever. These tests are the reason that cannot happen again quietly.
 */
/** The built worker `vite preview` is serving. */
function swPath(): string {
  return resolve(test.info().config.rootDir, '../apps/pwa/dist/sw.js')
}

test.describe.configure({ mode: 'serial' })

test('регистрируется и сообщает, что приложение готово офлайн', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.sw-toast')).toContainText('работает без интернета')
  await shot(page, 'sw-01-offline-ready')

  const state = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready
    return registration.active?.state ?? 'none'
  })
  expect(state).toBe('activated')
})

test('открывается без сети', async ({ page, context }) => {
  await start(page, '/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  // The package has to be in IndexedDB before the network goes away.
  await page.goto('/math')
  await expect(page.locator('.topic-card').first()).toBeVisible()

  await context.setOffline(true)
  try {
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Математика' })).toBeVisible()
    await expect(page.locator('.topic-card').first()).toBeVisible()
    await shot(page, 'sw-02-offline')
  } finally {
    await context.setOffline(false)
  }
})

test('предлагает обновиться, когда готова новая версия', async ({ page }) => {
  const path = swPath()
  const original = readFileSync(path, 'utf8')

  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)

  try {
    // A byte-different worker is exactly what a new deploy looks like to the
    // browser: it installs, then waits for someone to accept it.
    writeFileSync(path, `${original}\n// e2e bump ${Date.now()}\n`)
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      await registration.update()
    })

    await expect(page.locator('.sw-toast')).toContainText('Есть новая версия')
    await shot(page, 'sw-03-update-offered')

    // Accepting an update must reload the page, not merely swap the worker:
    // otherwise the child keeps looking at the old assets under a banner that
    // says the new version is ready.
    const reloaded = page.waitForEvent('load')
    await page.getByRole('button', { name: 'Обновить' }).click()
    await reloaded

    await expect(page.locator('.sw-toast')).toBeHidden()
    const waiting = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      return registration?.waiting?.state ?? null
    })
    expect(waiting).toBeNull()
  } finally {
    writeFileSync(path, original)
  }
})
