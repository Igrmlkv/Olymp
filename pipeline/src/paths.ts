import { resolve } from 'node:path'

/** Pipeline directory layout, resolved once instead of in every script. */
export const PIPELINE_ROOT = resolve(import.meta.dirname, '..')
export const REPO_ROOT = resolve(PIPELINE_ROOT, '..')
export const CONTENT_DIR = resolve(REPO_ROOT, 'content')
export const ARCHIVE_DIR = resolve(CONTENT_DIR, 'archive')
export const PROMPTS_DIR = resolve(PIPELINE_ROOT, 'prompts')

export function runDir(runId: string): string {
  return resolve(PIPELINE_ROOT, '.runs', runId)
}
