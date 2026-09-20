import { test as base, expect, type Locator, type Page } from '@playwright/test'
import type { Answer, ContentPackage, Subject, Task } from '@olymp/schema'

/**
 * Every test starts in a browser that has never seen the app: no IndexedDB, no
 * profile, no downloaded package. That is the state a real first visit is in,
 * and it is the state that used to hide bugs from us — our own browser had a
 * grade and a cached package from an earlier run.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: async ({ page }, use) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
    await use(errors)
  },
})

export { expect }

export const GRADE = 4

/** Package straight from the dev server, so tests assert against shipped content. */
const packages = new Map<string, Promise<ContentPackage>>()

export function contentPackage(subject: Subject, baseURL: string): Promise<ContentPackage> {
  const key = `${subject}-${GRADE}`
  let pending = packages.get(key)
  if (!pending) {
    pending = (async () => {
      const url = `${baseURL}/api/packages/${subject}/${GRADE}/latest.json`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(
          `${url} returned HTTP ${response.status}. Is the proxy worker running (pnpm dev:proxy)?`,
        )
      }
      return (await response.json()) as ContentPackage
    })()
    pending.catch(() => packages.delete(key))
    packages.set(key, pending)
  }
  return pending
}

/** Mirrors `tasksByTopic` in the app: same filter, same order, same list. */
export function tasksByTopic(pkg: ContentPackage, topic: string): Task[] {
  return pkg.tasks.filter((t) => t.topic === topic).sort((a, b) => a.level - b.level)
}

/** Opens the app as a first-time visitor and gets past the grade picker. */
export async function start(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  const picker = page.getByRole('heading', { name: 'В каком ты классе?' })
  if (await picker.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: `${GRADE} класс` }).click()
    await expect(picker).toBeHidden()
  }
}

/**
 * Fills in the organiser's own answer, in whatever shape the task expects.
 * Scoped to a root, because olympiad mode puts a dozen answer inputs on one
 * page and a page-wide locator would always find the first task's.
 */
export async function fillCorrectAnswer(root: Page | Locator, answer: Answer): Promise<void> {
  switch (answer.type) {
    case 'choice':
      await root.getByRole('radio', { name: answer.value, exact: true }).check()
      return
    case 'multi':
      for (const value of answer.value) {
        await root.getByRole('checkbox', { name: value, exact: true }).check()
      }
      return
    case 'parts':
      for (const [i, value] of answer.value.entries()) {
        await root.locator('.part .answer-input').nth(i).fill(value)
      }
      return
    default:
      await root.locator('input.answer-input').first().fill(String(answer.value))
  }
}

/** A wrong answer of the right shape, so "Проверить" is reachable. */
export async function fillWrongAnswer(root: Page | Locator, answer: Answer): Promise<void> {
  switch (answer.type) {
    case 'choice': {
      const other = answer.options.find((o) => o !== answer.value)!
      await root.getByRole('radio', { name: other, exact: true }).check()
      return
    }
    case 'multi': {
      // When every option is correct, ticking a single one is still wrong,
      // because the task needs all of them.
      const other = answer.options.find((o) => !answer.value.includes(o)) ?? answer.options[0]!
      await root.getByRole('checkbox', { name: other, exact: true }).check()
      return
    }
    case 'parts':
      for (const [i] of answer.value.entries()) {
        await root.locator('.part .answer-input').nth(i).fill('нет')
      }
      return
    default:
      await root.locator('input.answer-input').first().fill('-999')
  }
}

export const SHOT_DIR = 'e2e/screenshots'

export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true })
}
