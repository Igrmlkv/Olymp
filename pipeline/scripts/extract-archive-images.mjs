import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, resolve } from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'

/**
 * Pulls the figures out of the archive PDFs and writes them as optimised WebP
 * into content/archive/images/. Many grade-4 tasks are unanswerable without
 * their picture — balance scales, cube figures, lock dials — so the figure is
 * part of the task, not decoration.
 *
 * Needs poppler (`pdfimages`, `pdftotext`): brew install poppler
 *
 * Usage: node pipeline/scripts/extract-archive-images.mjs <pdf-dir> [--text]
 */

const run = promisify(execFile)

const REPO_ROOT = resolve(import.meta.dirname, '..', '..')
const OUT_DIR = resolve(REPO_ROOT, 'content', 'archive', 'images')

/** Below this, an "image" is a rule, a bullet or a colour swatch, not a figure. */
const MIN_PIXELS = 4000
const MIN_SIDE = 40
const MAX_WIDTH = 640

/**
 * Filenames encode where the figure came from, so a task referencing
 * `math-2425-sch-p2-02.webp` can be traced back to page 2 of that PDF.
 */
function slugFor(pdfName) {
  const m = pdfName.match(/^(tasks|sol|ans)-(math|russ)-4-(prigl|sch)-msk-(\d\d)-(\d\d)$/)
  if (!m) return pdfName
  const [, kind, subject, stage, from, to] = m
  // `kind` belongs in the name: the tasks and solutions PDFs of one paper
  // otherwise produce colliding filenames and silently overwrite each other.
  return `${subject === 'russ' ? 'russian' : 'math'}-${from}${to}-${stage}-${kind}`
}

async function extractOne(pdfPath, seen) {
  const name = basename(pdfPath, '.pdf')
  const slug = slugFor(name)
  const work = await mkdtemp(resolve(tmpdir(), 'olymp-pdf-'))

  try {
    await run('pdfimages', ['-png', '-p', pdfPath, resolve(work, 'i')])
    const files = (await readdir(work)).filter((f) => f.endsWith('.png')).sort()

    const kept = []
    for (const file of files) {
      const source = resolve(work, file)
      const image = sharp(source)
      const { width = 0, height = 0 } = await image.metadata()

      if (width < MIN_SIDE || height < MIN_SIDE || width * height < MIN_PIXELS) continue

      // `i-002-003.png` → page 2, index 3.
      const [, page, index] = file.match(/-(\d+)-(\d+)\.png$/) ?? []
      const outName = `${slug}-p${Number(page)}-${index}.webp`

      const pipeline = image.webp({ quality: 82, effort: 6 })
      const resized = width > MAX_WIDTH ? pipeline.resize({ width: MAX_WIDTH }) : pipeline
      const buffer = await resized.toBuffer()

      // The same figure is embedded once per page it appears on, and again in
      // the solutions PDF. Keep one copy under the first name that found it.
      const digest = createHash('sha256').update(buffer).digest('hex')
      const existing = seen.get(digest)
      if (existing) {
        kept.push({ file: existing, width, height, bytes: 0, duplicate: true })
        continue
      }
      seen.set(digest, outName)

      await writeFile(resolve(OUT_DIR, outName), buffer)
      kept.push({ file: outName, width, height, bytes: buffer.length })
    }

    return { name, slug, kept }
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

async function main() {
  const pdfDir = process.argv[2]
  if (!pdfDir) throw new Error('usage: extract-archive-images.mjs <pdf-dir> [--text]')
  const wantText = process.argv.includes('--text')

  await mkdir(OUT_DIR, { recursive: true })

  const pdfs = (await readdir(pdfDir)).filter((f) => f.endsWith('.pdf')).sort()
  const seen = new Map()
  let total = 0
  let bytes = 0
  const index = {}

  for (const pdf of pdfs) {
    const path = resolve(pdfDir, pdf)
    const { name, kept } = await extractOne(path, seen)
    const fresh = kept.filter((k) => !k.duplicate)
    total += fresh.length
    bytes += kept.reduce((s, k) => s + k.bytes, 0)
    index[name] = kept.map((k) => k.file)
    console.log(`${name}: ${fresh.length} новых${kept.length > fresh.length ? `, ${kept.length - fresh.length} повторов` : ''}`)

    if (wantText) {
      const txt = resolve(pdfDir, `${basename(pdf, '.pdf')}.txt`)
      await run('pdftotext', ['-layout', path, txt])
    }
  }

  // An index from PDF to figures, so a task author can find the right file.
  await writeFile(resolve(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n')

  console.log(`\nвсего ${total} рисунков, ${(bytes / 1024 / 1024).toFixed(2)} MB → content/archive/images/`)
}

await main()
