import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  ContentPackageSchema,
  TaskSchema,
  packageKey,
  type ContentPackage,
  type Grade,
  type Subject,
  type Task,
} from '@olymp/schema'
import { computeChecksum } from './checksum.js'

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

const ROOT = resolve(import.meta.dirname, '..')
const ARCHIVE_DIR = resolve(ROOT, '..', 'content', 'archive')

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2)
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? undefined : argv[index + 1]
}

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
  const subject = arg('subject') as Subject | undefined
  const grade = Number(arg('grade')) as Grade
  const version = arg('version')
  if (!subject || !grade || !version) {
    throw new Error('usage: import-archive -- --subject <math|russian> --grade <n> --version <semver>')
  }

  const tasks = await loadArchiveTasks(subject, grade)
  if (tasks.length === 0) throw new Error(`нет архивных задач для ${subject}, класс ${grade}`)

  const missingAttribution = tasks.filter((t) => t.source_attribution === null)
  if (missingAttribution.length > 0) {
    throw new Error(`задачи без атрибуции: ${missingAttribution.map((t) => t.id).join(', ')}`)
  }

  const pkg: ContentPackage = {
    manifest: {
      package_id: `${subject}-${grade}`,
      version,
      subject,
      grade,
      created_at: new Date().toISOString(),
      prompt_version: 'archive-import-v1',
      task_count: tasks.length,
      checksum: computeChecksum(tasks),
      verification_summary: {
        total: tasks.length,
        passed: tasks.filter((t) => t.verification.verdict === 'pass').length,
        failed: tasks.filter((t) => t.verification.verdict === 'fail').length,
        needs_review: tasks.filter((t) => t.verification.verdict === 'needs_review').length,
      },
    },
    tasks,
  }

  ContentPackageSchema.parse(pkg)

  const key = packageKey(subject, grade, version)
  const outPath = resolve(ROOT, '..', 'content', key)
  await mkdir(resolve(outPath, '..'), { recursive: true })
  await writeFile(outPath, JSON.stringify(pkg, null, 2))

  // `latest` is the pointer the client actually fetches.
  const latestPath = resolve(ROOT, '..', 'content', packageKey(subject, grade, 'latest'))
  await writeFile(latestPath, JSON.stringify(pkg, null, 2))

  const byTopic = new Map<string, number>()
  for (const t of tasks) byTopic.set(t.topic, (byTopic.get(t.topic) ?? 0) + 1)

  console.log(`[import-archive] ${tasks.length} задач → content/${key}`)
  for (const [topic, count] of [...byTopic].sort()) console.log(`  ${topic}: ${count}`)
  console.log(`[import-archive] checksum ${pkg.manifest.checksum.slice(0, 16)}…`)
}

await main()
