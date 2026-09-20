import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Task } from '@olymp/schema'
import { requireArg } from './args.js'
import { buildPackage, uploadHint, writePackage } from './package-writer.js'
import { runDir } from './paths.js'

/**
 * Assembles a verified run into a versioned content package. Only tasks with a
 * `pass` verdict ship; anything else stays in the run directory for review.
 *
 * Usage: pnpm --filter @olymp/pipeline publish -- --run <run-id> --version 1.0.0
 */

const USAGE = 'usage: publish -- --run <run-id> --version <semver>'

async function main(): Promise<void> {
  const runId = requireArg('run', USAGE)
  const version = requireArg('version', USAGE)

  const run = JSON.parse(await readFile(resolve(runDir(runId), 'verified.json'), 'utf8')) as {
    prompt_version: string
    tasks: Task[]
  }

  const tasks = run.tasks.filter((t) => t.verification.verdict === 'pass')
  if (tasks.length === 0) throw new Error('нет задач со статусом pass — публиковать нечего')

  const pkg = buildPackage(tasks, {
    version,
    promptVersion: run.prompt_version,
    consideredTotal: run.tasks.length,
  })
  const key = await writePackage(pkg)

  console.log(`[publish] ${tasks.length} задач → content/${key}`)
  console.log(`[publish] ${uploadHint(pkg)}`)
}

await main()
