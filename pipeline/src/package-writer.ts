import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  ContentPackageSchema,
  packageKey,
  summariseVerdicts,
  type ContentPackage,
  type Task,
} from '@olymp/schema'
import { computeChecksum } from './checksum.js'
import { CONTENT_DIR } from './paths.js'

/**
 * Assembling and writing a content package, in one place. publish.ts and
 * import-archive.ts each had their own copy, and they had already drifted:
 * only one of them wrote the `latest` pointer, so a package published through
 * the other left `latest` pointing at the previous version.
 */

export function buildPackage(
  tasks: Task[],
  options: { version: string; promptVersion: string; consideredTotal?: number },
): ContentPackage {
  const first = tasks[0]
  if (!first) throw new Error('нечего публиковать: список задач пуст')

  const summary = summariseVerdicts(tasks)

  const pkg: ContentPackage = {
    manifest: {
      package_id: `${first.subject}-${first.grade}`,
      version: options.version,
      subject: first.subject,
      grade: first.grade,
      created_at: new Date().toISOString(),
      prompt_version: options.promptVersion,
      task_count: tasks.length,
      checksum: computeChecksum(tasks),
      // `total` counts everything considered, including tasks that did not ship.
      verification_summary: { ...summary, total: options.consideredTotal ?? summary.total },
    },
    tasks,
  }

  // Fail here rather than shipping a package the client would reject.
  return ContentPackageSchema.parse(pkg)
}

/** Writes the pinned version and repoints `latest` at it. Returns the version key. */
export async function writePackage(pkg: ContentPackage): Promise<string> {
  const { subject, grade, version } = pkg.manifest
  const body = JSON.stringify(pkg, null, 2)

  const versionKey = packageKey(subject, grade, version)
  const versionPath = resolve(CONTENT_DIR, versionKey)
  await mkdir(resolve(versionPath, '..'), { recursive: true })
  await writeFile(versionPath, body)
  await writeFile(resolve(CONTENT_DIR, packageKey(subject, grade, 'latest')), body)

  return versionKey
}

/** The two uploads that put a written package live. */
export function uploadHint(pkg: ContentPackage): string {
  const { subject, grade, version } = pkg.manifest
  const put = (key: string, from: string) =>
    `  wrangler r2 object put olymp-packages/${key} --file content/${from} --jurisdiction eu`
  const versionKey = packageKey(subject, grade, version)
  return [
    'загрузить в R2:',
    put(versionKey, versionKey),
    put(packageKey(subject, grade, 'latest'), versionKey),
  ].join('\n')
}
