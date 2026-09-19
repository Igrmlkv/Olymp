import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ContentPackageSchema, packageKey, type ContentPackage, type Task } from '@olymp/schema'
import { computeChecksum } from './checksum.js'

/**
 * Assembles a verified run into a versioned content package. Only tasks with a
 * `pass` verdict ship; anything else stays in the run directory for review.
 *
 * The package is written to content/packages/ and must then be uploaded to R2:
 *   wrangler r2 object put olymp-packages/<key> --file <path> --jurisdiction eu
 *
 * Usage: pnpm --filter @olymp/pipeline publish -- --run <run-id> --version 1.0.0
 */

const ROOT = resolve(import.meta.dirname, '..')

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2)
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? undefined : argv[index + 1]
}

async function main(): Promise<void> {
  const runId = arg('run')
  const version = arg('version')
  if (!runId || !version) throw new Error('usage: publish -- --run <run-id> --version <semver>')

  const runDir = resolve(ROOT, '.runs', runId)
  const run = JSON.parse(await readFile(resolve(runDir, 'verified.json'), 'utf8')) as {
    prompt_version: string
    tasks: Task[]
  }

  const tasks = run.tasks.filter((t) => t.verification.verdict === 'pass')
  if (tasks.length === 0) throw new Error('нет задач со статусом pass — публиковать нечего')

  const first = tasks[0]!
  const pkg: ContentPackage = {
    manifest: {
      package_id: `${first.subject}-${first.grade}`,
      version,
      subject: first.subject,
      grade: first.grade,
      created_at: new Date().toISOString(),
      prompt_version: run.prompt_version,
      task_count: tasks.length,
      checksum: computeChecksum(tasks),
      verification_summary: {
        total: run.tasks.length,
        passed: tasks.length,
        failed: run.tasks.filter((t) => t.verification.verdict === 'fail').length,
        needs_review: run.tasks.filter((t) => t.verification.verdict === 'needs_review').length,
      },
    },
    tasks,
  }

  // Fails loudly rather than shipping a package the client would reject.
  ContentPackageSchema.parse(pkg)

  const key = packageKey(pkg.manifest.subject, pkg.manifest.grade, version)
  const outPath = resolve(ROOT, '..', 'content', key)
  await mkdir(resolve(outPath, '..'), { recursive: true })
  await writeFile(outPath, JSON.stringify(pkg, null, 2))

  console.log(`[publish] ${tasks.length} задач → content/${key}`)
  console.log(`[publish] загрузить в R2:`)
  console.log(`  wrangler r2 object put olymp-packages/${key} --file content/${key} --jurisdiction eu`)
  console.log(
    `  wrangler r2 object put olymp-packages/${packageKey(pkg.manifest.subject, pkg.manifest.grade, 'latest')} ` +
      `--file content/${key} --jurisdiction eu`,
  )
}

await main()
