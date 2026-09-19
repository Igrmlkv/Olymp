import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { z } from 'zod'
import { AnswerSchema, GRADE_MAPPING, GradeSchema, SubjectSchema, TopicSchema, type Task } from '@olymp/schema'
import { createClient, extractJson, textFrom } from './anthropic-client.js'
import { MODELS } from './models.js'

/**
 * Generates a batch of tasks and writes them to pipeline/.runs/<id>/draft.json.
 * Nothing is published here — verify.ts must pass first.
 *
 * Usage:
 *   pnpm --filter @olymp/pipeline generate -- --subject math --grade 4 --topic word_problems --level 2 --count 10
 */

const PROMPT_VERSION = 'gen-v1'
const ROOT = resolve(import.meta.dirname, '..')

const DraftTaskSchema = z.object({
  statement_md: z.string().min(1),
  answer: AnswerSchema,
  solution_md: z.string().min(1),
  hints: z.array(z.string().min(1)).min(1).max(5),
  points: z.number().int().min(1).default(1),
})

const ArgsSchema = z.object({
  subject: SubjectSchema,
  grade: GradeSchema,
  topic: TopicSchema,
  level: z.number().int().min(1).max(5),
  count: z.number().int().min(1).max(50),
})

function parseArgs(argv: string[]): z.infer<typeof ArgsSchema> {
  const raw: Record<string, string> = {}
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '')
    const value = argv[i + 1]
    if (key && value) raw[key] = value
  }
  return ArgsSchema.parse({
    subject: raw.subject,
    grade: Number(raw.grade),
    topic: raw.topic,
    level: Number(raw.level ?? 1),
    count: Number(raw.count ?? 10),
  })
}

const SUBJECT_RU = { math: 'математика', russian: 'русский язык' } as const

async function loadFewShot(subject: string, topic: string): Promise<string> {
  // Archive samples are the difficulty anchor. Absent an archive, the model
  // still produces tasks, just with a looser calibration — flagged in the log.
  try {
    const path = resolve(ROOT, '..', 'content', 'archive', `${subject}-${topic}.json`)
    const samples = JSON.parse(await readFile(path, 'utf8')) as unknown[]
    return JSON.stringify(samples.slice(0, 3), null, 2)
  } catch {
    console.warn(`[generate] нет архивных образцов для ${subject}/${topic}; калибровка сложности слабее`)
    return '(образцов нет)'
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const client = createClient()

  const template = await readFile(resolve(ROOT, 'prompts', 'generation.md'), 'utf8')
  const fewShot = await loadFewShot(args.subject, args.topic)

  const prompt = template
    .replace(/\{\{subject_ru\}\}/g, SUBJECT_RU[args.subject])
    .replace(/\{\{grade\}\}/g, String(args.grade))
    .replace(/\{\{topic_ru\}\}/g, args.topic)
    .replace(/\{\{level\}\}/g, String(args.level))
    .replace(/\{\{count\}\}/g, String(args.count))
    .replace(/\{\{few_shot\}\}/g, fewShot)

  const response = await client.messages.create({
    model: MODELS.generator,
    max_tokens: 16_000,
    thinking: { type: 'enabled', budget_tokens: 8_000 },
    messages: [{ role: 'user', content: prompt }],
  })

  const text = textFrom(response)

  const drafts = z.array(DraftTaskSchema).parse(extractJson(text))

  const tasks: Task[] = drafts.map((draft) => ({
    id: `${args.subject}-${args.grade}-${randomUUID()}`,
    subject: args.subject,
    grade: args.grade,
    grade_mapping: GRADE_MAPPING[args.grade],
    topic: args.topic,
    level: args.level,
    origin: 'generated',
    source_attribution: null,
    statement_md: draft.statement_md,
    answer: draft.answer,
    solution_md: draft.solution_md,
    hints: draft.hints,
    points: draft.points,
    // Provisional: verify.ts overwrites this with a real verdict.
    verification: { verdict: 'needs_review', method: 'not_yet_verified', model: MODELS.generator },
  }))

  const runId = `${args.subject}-${args.grade}-${args.topic}-${Date.now()}`
  const runDir = resolve(ROOT, '.runs', runId)
  await mkdir(runDir, { recursive: true })
  await writeFile(
    resolve(runDir, 'draft.json'),
    JSON.stringify({ prompt_version: PROMPT_VERSION, model: MODELS.generator, tasks }, null, 2),
  )

  console.log(`[generate] ${tasks.length} задач → pipeline/.runs/${runId}/draft.json`)
  console.log(`[generate] следующий шаг: pnpm --filter @olymp/pipeline verify -- --run ${runId}`)
}

await main()
