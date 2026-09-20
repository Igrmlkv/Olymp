import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { TaskSchema, type Grade, type Subject, type Task } from '@olymp/schema'
import { requireArg } from './args.js'
import { inlineImages, type InlineStats } from './inline-images.js'
import { buildPackage, uploadHint, writePackage } from './package-writer.js'
import { ARCHIVE_DIR } from './paths.js'

/**
 * Assembles the hand-curated archive files in content/archive/ into a publishable
 * content package. Archive tasks bypass generate/verify: their answers come from
 * the organiser's own answer key, which is a stronger source than a model run.
 *
 * Every task is still validated against TaskSchema, so a missing attribution or
 * an answer that is not among its own options fails here rather than in the app.
 *
 * Usage: pnpm --filter @olymp/pipeline import-archive -- --subject math --grade 4 --version 1.0.0
 */

const USAGE = 'usage: import-archive -- --subject <math|russian> --grade <n> --version <semver>'

async function loadArchiveTasks(subject: Subject, grade: Grade): Promise<Task[]> {
  const files = (await readdir(ARCHIVE_DIR)).filter(
    (f) => f.startsWith(`${subject}-`) && f.endsWith('.json'),
  )

  const tasks: Task[] = []
  for (const file of files) {
    const raw: unknown = JSON.parse(await readFile(resolve(ARCHIVE_DIR, file), 'utf8'))
    if (!Array.isArray(raw)) throw new Error(`${file}: ожидался массив задач`)

    raw.forEach((entry, i) => {
      const parsed = TaskSchema.safeParse(entry)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        throw new Error(`${file}[${i}]: ${issue?.path.join('.')} — ${issue?.message}`)
      }
      if (parsed.data.grade === grade) tasks.push(parsed.data)
    })
  }

  // Stable order, so the checksum does not change with directory listing order.
  return tasks.sort((a, b) => a.id.localeCompare(b.id))
}

async function main(): Promise<void> {
  const subject = requireArg('subject', USAGE) as Subject
  const grade = Number(requireArg('grade', USAGE)) as Grade
  const version = requireArg('version', USAGE)

  const tasks = await loadArchiveTasks(subject, grade)
  if (tasks.length === 0) throw new Error(`нет архивных задач для ${subject}, класс ${grade}`)

  // TaskSchema already refuses an archive task without attribution; this states
  // the same legal invariant where a reader of the pipeline will see it.
  const unattributed = tasks.filter((t) => t.source_attribution === null)
  if (unattributed.length > 0) {
    throw new Error(`задачи без атрибуции: ${unattributed.map((t) => t.id).join(', ')}`)
  }

  // Papers repeat themselves across stages and years, and a child meeting the
  // same question twice in one topic reads as a bug.
  //
  // The key covers the answer too, not just the wording: several papers reuse a
  // stem like "выберите ряд, в каждом слове которого…" over different word
  // lists, and those are different questions despite the identical sentence.
  const byQuestion = new Map<string, string[]>()
  for (const task of tasks) {
    const key = [
      task.statement_md.replace(/\s+/g, ' ').trim(),
      JSON.stringify(task.answer),
    ].join('\u0000')
    byQuestion.set(key, [...(byQuestion.get(key) ?? []), task.id])
  }
  const duplicates = [...byQuestion.values()].filter((ids) => ids.length > 1)
  if (duplicates.length > 0) {
    throw new Error(
      `одинаковые условия у задач:\n${duplicates.map((ids) => '  ' + ids.join(' = ')).join('\n')}`,
    )
  }

  // Figures are inlined last, so the schema check above still reads short,
  // human-legible statements rather than megabytes of base64.
  const cache = new Map<string, string>()
  const stats: InlineStats = { references: 0, distinctImages: 0, bytes: 0 }
  const withImages: Task[] = []
  for (const task of tasks) {
    withImages.push({
      ...task,
      statement_md: await inlineImages(task.statement_md, cache, stats),
      solution_md: await inlineImages(task.solution_md, cache, stats),
    })
  }

  const pkg = buildPackage(withImages, { version, promptVersion: 'archive-import-v1' })
  const key = await writePackage(pkg)

  const byTopic = new Map<string, number>()
  for (const t of tasks) byTopic.set(t.topic, (byTopic.get(t.topic) ?? 0) + 1)

  console.log(`[import-archive] ${tasks.length} задач → content/${key}`)
  for (const [topic, count] of [...byTopic].sort()) console.log(`  ${topic}: ${count}`)
  console.log(
    `[import-archive] рисунков: ${stats.distinctImages} (${stats.references} вставок, ` +
      `${(stats.bytes / 1024 / 1024).toFixed(2)} MB)`,
  )
  console.log(`[import-archive] checksum ${pkg.manifest.checksum.slice(0, 16)}…`)
  console.log(`[import-archive] ${uploadHint(pkg)}`)
}

await main()
