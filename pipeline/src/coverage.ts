import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ContentPackageSchema, packageKey, type ContentPackage } from '@olymp/schema'
import { coverageFor, loadPapers, unknownSources } from './papers.js'
import { CONTENT_DIR } from './paths.js'

/**
 * Prints how much of every published paper is in the bank. Answers, with a
 * number, the question the hand-written table could not: is the archive in
 * fully, and if not, what exactly is missing.
 */
const SHIPPED = [
  { subject: 'math', grade: 4 },
  { subject: 'russian', grade: 4 },
] as const

function load(subject: 'math' | 'russian', grade: 4): ContentPackage {
  const path = resolve(CONTENT_DIR, packageKey(subject, grade, 'latest'))
  return ContentPackageSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
}

const papers = loadPapers()
const packages = SHIPPED.map(({ subject, grade }) => load(subject, grade))
const rows = coverageFor(papers, packages)

console.log('| Работа | Этап | В работе | В банке | Непригодно | Осталось взять |')
console.log('|---|---|---:|---:|---:|---:|')

for (const { paper, taken, unusable, remaining } of rows) {
  const subject = paper.subject === 'math' ? 'Математика' : 'Русский'
  const stage = paper.stage === 'school' ? 'школьный' : 'пригласительный'
  console.log(
    `| ${subject} ${paper.season} | ${stage} | ${paper.task_count ?? '—'} | ${taken} |` +
      ` ${unusable || ''} | ${remaining === null ? 'не сверено' : remaining || ''} |`,
  )
}

// Totals only over the papers somebody has counted: mixing them with the rest
// would produce a number that looks like coverage and is not one.
const counted = rows.filter((r) => r.paper.task_count !== null)
const sum = (rs: typeof rows, f: (r: (typeof rows)[number]) => number) =>
  rs.reduce((total, r) => total + f(r), 0)

console.log()
console.log(`Сверено с PDF: ${counted.length} работ из ${rows.length}.`)
console.log(
  `В них ${sum(counted, (r) => r.paper.task_count ?? 0)} заданий: ` +
    `${sum(counted, (r) => r.taken)} в банке, ` +
    `${sum(counted, (r) => r.unusable)} непригодны, ` +
    `${sum(counted, (r) => r.remaining ?? 0)} можно взять.`,
)
console.log(
  `Всего в банке задач: ${sum(rows, (r) => r.taken)}, ` +
    `из них ${sum(rows, (r) => r.taken) - sum(counted, (r) => r.taken)} — из несверенных работ.`,
)

const unknown = unknownSources(papers, packages)
if (unknown.length > 0) {
  console.log()
  console.log('Задачи ссылаются на источники, которых нет в манифесте:')
  for (const url of unknown) console.log(`  ${url}`)
  process.exitCode = 1
}
