import type { Subject } from '@olymp/schema'
import {
  contentPackage,
  expect,
  fillCorrectAnswer,
  fillWrongAnswer,
  shot,
  start,
  tasksByTopic,
  test,
} from './app-fixtures.js'

/**
 * The same journey through both subjects: first run, topics, the task list,
 * solving, the marks, and paging between tasks. Everything a child does on
 * their first evening with the app.
 */
const SUBJECTS: { subject: Subject; label: string }[] = [
  { subject: 'math', label: 'Математика' },
  { subject: 'russian', label: 'Русский язык' },
]

test.afterEach(async ({ consoleErrors }) => {
  expect(consoleErrors, 'браузерная консоль должна оставаться чистой').toEqual([])
})

test('первый запуск: выбор класса и главный экран', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'В каком ты классе?' })).toBeVisible()
  await shot(page, '00-grade-picker')

  await page.getByRole('button', { name: '4 класс' }).click()
  await expect(page.getByRole('heading', { name: 'Олимп' })).toBeVisible()
  await expect(page.getByText('4 класс ≈ groep 6')).toBeVisible()
  await shot(page, '01-home')
})

for (const { subject, label } of SUBJECTS) {
  test.describe(label, () => {
    test(`${subject}: темы показывают все задачи пакета`, async ({ page, baseURL }) => {
      const pkg = await contentPackage(subject, baseURL!)

      await start(page, `/${subject}`)
      await expect(page.getByRole('heading', { name: label })).toBeVisible()

      const cards = page.locator('.topic-card')
      await expect(cards.first()).toBeVisible()
      await shot(page, `${subject}-02-topics`)

      // Every task in the package has to be reachable through some topic;
      // a task the topic list cannot count is a task nobody can open.
      const counted = await cards.evaluateAll((nodes) =>
        nodes.map((n) => Number(/\d+/.exec(n.textContent ?? '')?.[0] ?? '0')),
      )
      expect(counted.reduce((a, b) => a + b, 0)).toBe(pkg.tasks.length)
    })

    test(`${subject}: список задач, решение и отметки`, async ({ page, baseURL }) => {
      const pkg = await contentPackage(subject, baseURL!)
      const topic = biggestTopic(pkg.tasks)
      const tasks = tasksByTopic(pkg, topic)

      await start(page, `/${subject}/${topic}`)
      await expect(page.getByText(`решено 0`)).toBeVisible()
      const rows = page.locator('.task-row')
      await expect(rows).toHaveCount(tasks.length)
      await shot(page, `${subject}-03-task-list`)

      // Solve the first one.
      await rows.first().click()
      await expect(page).toHaveURL(new RegExp(`/${subject}/${topic}/`))
      await expect(page.locator('.statement')).toBeVisible()
      await expect(page.getByText(`задача 1 из ${tasks.length}`)).toBeVisible()

      const first = tasks[0]!
      // Auteurswet art. 15a: an archive statement is never shown without its
      // source. This is the check that the rule survives a refactor.
      if (first.origin === 'archive') {
        await expect(page.locator('.attribution')).toBeVisible()
      }
      await shot(page, `${subject}-04-task`)

      await fillCorrectAnswer(page, first.answer)
      await page.getByRole('button', { name: 'Проверить' }).click()
      await expect(page.locator('.verdict--ok')).toBeVisible()
      await shot(page, `${subject}-05-correct`)

      // Get the second one wrong.
      await page.getByRole('button', { name: 'Следующая →' }).click()
      await expect(page.getByText(`задача 2 из ${tasks.length}`)).toBeVisible()
      await fillWrongAnswer(page, tasks[1]!.answer)
      await page.getByRole('button', { name: 'Проверить' }).click()
      await expect(page.locator('.verdict--no')).toBeVisible()

      // Both outcomes have to show up in the list.
      await page.getByRole('link', { name: '← К списку задач' }).click()
      await expect(page.getByText('решено 1')).toBeVisible()
      await expect(rows.nth(0)).toHaveClass(/task-row--solved/)
      await expect(rows.nth(1)).toHaveClass(/task-row--attempted/)
      await shot(page, `${subject}-06-list-marks`)

      // Progress lives in IndexedDB and nowhere else (no accounts, no sync),
      // so a reload is the only proof that it was actually written.
      await page.reload()
      await expect(page.getByText('решено 1')).toBeVisible()
      await expect(rows.nth(0)).toHaveClass(/task-row--solved/)
    })

    test(`${subject}: строки списка различимы между собой`, async ({ page, baseURL }) => {
      const pkg = await contentPackage(subject, baseURL!)
      const topic = biggestTopic(pkg.tasks)

      await start(page, `/${subject}/${topic}`)
      await expect(page.locator('.task-row').first()).toBeVisible()

      const titles = await page
        .locator('.task-row-title')
        .evaluateAll((nodes) => nodes.map((n) => n.textContent ?? ''))

      expect(titles.length).toBeGreaterThan(10)
      expect(titles.some((t) => t.trim() === '')).toBe(false)

      // Archive papers share an opening between grouped tasks. If the list
      // repeats it, a child cannot tell which task they already opened.
      const unique = new Set(titles)
      expect(
        unique.size,
        `одинаковых строк: ${titles.length - unique.size}`,
      ).toBeGreaterThanOrEqual(titles.length - 2)
    })

    test(`${subject}: задача открывается по прямой ссылке и листается назад`, async ({
      page,
      baseURL,
    }) => {
      const pkg = await contentPackage(subject, baseURL!)
      const topic = biggestTopic(pkg.tasks)
      const tasks = tasksByTopic(pkg, topic)
      const third = tasks[2]!

      // A task URL is meant to survive a reload and a shared link.
      await start(page, `/${subject}/${topic}/${third.id}`)
      await expect(page.getByText(`задача 3 из ${tasks.length}`)).toBeVisible()

      await page.getByRole('button', { name: '← Предыдущая' }).click()
      await expect(page).toHaveURL(new RegExp(`${tasks[1]!.id}$`))

      await page.goBack()
      await expect(page).toHaveURL(new RegExp(`${third.id}$`))
    })

    test(`${subject}: подсказки и разбор раскрываются`, async ({ page, baseURL }) => {
      const pkg = await contentPackage(subject, baseURL!)
      const topic = biggestTopic(pkg.tasks)
      const first = tasksByTopic(pkg, topic)[0]!

      await start(page, `/${subject}/${topic}/${first.id}`)
      await page.getByRole('button', { name: /Подсказка/ }).click()
      await expect(page.locator('.hints li')).toHaveCount(1)

      await page.getByRole('button', { name: 'Показать разбор' }).click()
      await expect(page.locator('.solution')).toBeVisible()
      await shot(page, `${subject}-07-hint-and-solution`)
    })

    test(`${subject}: олимпиада идёт от старта до результата`, async ({ page, baseURL }) => {
      const pkg = await contentPackage(subject, baseURL!)

      await start(page, `/olympiad/${subject}`)
      await expect(page.getByRole('heading', { name: 'Режим олимпиады' })).toBeVisible()
      await shot(page, `${subject}-08-olympiad-brief`)

      await page.getByRole('button', { name: 'Начать' }).click()
      await expect(page.locator('.timer')).toBeVisible()

      const items = page.locator('.olympiad-tasks > li')
      const count = await items.count()
      expect(count).toBeGreaterThan(0)
      await shot(page, `${subject}-09-olympiad-paper`)

      // Answer the whole paper correctly: the score has to come out at the
      // ceiling this run actually offers.
      const shown = pkg.tasks.slice(0, count)
      let available = 0
      for (const [i, task] of shown.entries()) {
        await fillCorrectAnswer(items.nth(i), task.answer)
        available += task.points
      }

      await page.getByRole('button', { name: 'Завершить' }).click()
      await expect(page.locator('.verdict--ok')).toContainText(`${available} из ${available}`)
      await shot(page, `${subject}-10-olympiad-result`)
    })

    test(`${subject}: задача с рисунком показывает рисунок`, async ({ page, baseURL }) => {
      const pkg = await contentPackage(subject, baseURL!)
      const task = pkg.tasks.find((t) => /!\[[^\]]*]\(/.test(t.statement_md))!
      expect(task, 'в пакете должна быть задача с рисунком').toBeTruthy()

      await start(page, `/${subject}/${task.topic}/${task.id}`)
      const images = page.locator('.statement img')
      await expect(images.first()).toBeVisible()

      // Figures are inlined into the package as data URIs, so a broken one is
      // broken for every offline user at once. A decoded image has width.
      const widths = await images.evaluateAll((nodes) =>
        nodes.map((n) => (n as HTMLImageElement).naturalWidth),
      )
      expect(widths.every((w) => w > 0), `рисунки не отрисовались: ${widths.join(', ')}`).toBe(true)
      await shot(page, `${subject}-11-task-with-image`)
    })

    test(`${subject}: тема без задач не притворяется ссылкой`, async ({ page }) => {
      await start(page, `/${subject}`)
      await expect(page.locator('.topic-card').first()).toBeVisible()

      // No card may ever read "0 задач": either the topic has tasks, or it is
      // marked "скоро" and is not a link at all.
      await expect(page.locator('.topic-card').filter({ hasText: /(^|\D)0 задач/ })).toHaveCount(0)

      const empty = page.locator('.topic-card--empty')
      test.skip((await empty.count()) === 0, 'в этом предмете пустых тем нет')

      await expect(empty.first()).toHaveAttribute('aria-disabled', 'true')
      expect(await empty.first().evaluate((node) => node.tagName)).not.toBe('A')
      await shot(page, `${subject}-12-empty-topic`)
    })

    test(`${subject}: каждая тема открывается без ошибки`, async ({ page, baseURL }) => {
      const pkg = await contentPackage(subject, baseURL!)
      await start(page, `/${subject}`)
      await expect(page.locator('.topic-card').first()).toBeVisible()

      // Only the topics that are actually links; the empty ones are not.
      const links = await page.locator('a.topic-card').evaluateAll((nodes) =>
        nodes.map((n) => (n as HTMLAnchorElement).getAttribute('href')!),
      )
      expect(links.length).toBeGreaterThan(0)

      for (const href of links) {
        await page.goto(href)
        await expect(page.locator('.error')).toHaveCount(0)
        const topic = href.split('/').pop()!
        await expect(page.locator('.task-row')).toHaveCount(tasksByTopic(pkg, topic).length)
      }
    })
  })
}

test('тема без задач объясняет себя по прямой ссылке', async ({ page }) => {
  // The card is not a link, but the address still exists and can be shared.
  await start(page, '/math/fractions')
  await expect(page.getByRole('heading', { name: 'Доли и дроби' })).toBeVisible()
  await expect(page.getByText(/пока нет задач/)).toBeVisible()
  await expect(page.locator('.task-row')).toHaveCount(0)
  await shot(page, '13-empty-topic-direct')
})

test('родитель видит версию банка и может обновить его', async ({ page }) => {
  // The bank has to be on the device before there is a version to show.
  await start(page, '/math')
  await expect(page.locator('.topic-card').first()).toBeVisible()

  await page.goto('/parents')
  await expect(page.getByText(/Математика: \d+ задач/)).toBeVisible()

  // Pretend this device is stuck on an old bank — which is what every device
  // was until packages started being re-checked, and how one of ours ended up
  // showing the fifteen tasks of the first day for a week.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('olymp')
        open.onsuccess = () => {
          const tx = open.result.transaction('packages', 'readwrite')
          const store = tx.objectStore('packages')
          const get = store.get('math-4')
          get.onsuccess = () => {
            const row = get.result
            row.version = '0.0.1'
            store.put(row)
          }
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
        open.onerror = () => reject(open.error)
      }),
  )

  await page.reload()
  await expect(page.getByText('версия 0.0.1')).toBeVisible()

  const reloaded = page.waitForEvent('load')
  await page.getByRole('button', { name: 'Проверить обновления' }).click()
  await reloaded

  await expect(page.getByText('версия 0.0.1')).toBeHidden()
  await shot(page, '14-parents-package-version')
})

/** The topic with the most tasks: the one a child is most likely to open. */
function biggestTopic(tasks: { topic: string }[]): string {
  const counts = new Map<string, number>()
  for (const task of tasks) counts.set(task.topic, (counts.get(task.topic) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0]
}
