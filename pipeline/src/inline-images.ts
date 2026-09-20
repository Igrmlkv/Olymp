import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ARCHIVE_DIR } from './paths.js'

/**
 * Archive task files reference figures as `![alt](images/name.webp)`, which keeps
 * them readable and diffable in the repo. Packages inline those figures as data
 * URIs instead: a task whose picture failed to load is unanswerable, and the app
 * is offline-first, so the picture has to travel inside the package rather than
 * be fetched later.
 */

const IMAGE_REF = /!\[([^\]]*)\]\(images\/([A-Za-z0-9._-]+\.webp)\)/g

export interface InlineStats {
  references: number
  distinctImages: number
  bytes: number
}

export async function inlineImages(
  markdown: string,
  cache: Map<string, string>,
  stats: InlineStats,
): Promise<string> {
  const names = [...markdown.matchAll(IMAGE_REF)].map((m) => m[2]!)

  for (const name of names) {
    if (cache.has(name)) continue
    const path = resolve(ARCHIVE_DIR, 'images', name)
    let buffer: Buffer
    try {
      buffer = await readFile(path)
    } catch {
      throw new Error(`рисунок не найден: content/archive/images/${name}`)
    }
    cache.set(name, `data:image/webp;base64,${buffer.toString('base64')}`)
    stats.distinctImages += 1
    stats.bytes += buffer.length
  }

  return markdown.replace(IMAGE_REF, (_match, alt: string, name: string) => {
    stats.references += 1
    const uri = cache.get(name)
    if (!uri) throw new Error(`рисунок не подготовлен: ${name}`)
    // Alt text stays: it is what a screen reader reads out.
    return `![${alt}](${uri})`
  })
}

/** True when a markdown string still points at a file instead of a data URI. */
export function hasUninlinedImage(markdown: string): boolean {
  IMAGE_REF.lastIndex = 0
  return IMAGE_REF.test(markdown)
}
