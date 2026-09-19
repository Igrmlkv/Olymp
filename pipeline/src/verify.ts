import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import { TaskSchema, type Task } from '@olymp/schema'
import { createClient, extractJson, textFrom } from './anthropic-client.js'
import { MODELS, SELF_CONSISTENCY_RUNS, SELF_CONSISTENCY_THRESHOLD } from './models.js'

/**
 * Independent verification pass. Each task is solved from scratch several times;
 * a task only passes on a strict majority AND an unambiguous-statement verdict.
 * Disagreements go to the adjudicator model rather than being resolved by a
 * coin flip.
 *
 * Usage: pnpm --filter @olymp/pipeline verify -- --run <run-id>
 */

const ROOT = resolve(import.meta.dirname, '..')

const VerdictSchema = z.object({
  own_answer: z.string(),
  matches: z.boolean(),
  unambiguous: z.boolean(),
  verdict: z.enum(['pass', 'fail', 'needs_review']),
  notes: z.string().default(''),
})
type Verdict = z.infer<typeof VerdictSchema>

async function solveOnce(
  client: ReturnType<typeof createClient>,
  template: string,
  task: Task,
  model: string,
): Promise<Verdict> {
  const prompt = template
    .replace(/\{\{statement\}\}/g, task.statement_md)
    .replace(/\{\{claimed_answer\}\}/g, JSON.stringify(task.answer.value))

  const response = await client.messages.create({
    model,
    max_tokens: 8_000,
    thinking: { type: 'enabled', budget_tokens: 4_000 },
    messages: [{ role: 'user', content: prompt }],
  })

  const text = textFrom(response)

  return VerdictSchema.parse(extractJson(text))
}

async function main(): Promise<void> {
  const runId = process.argv.slice(2).find((_, i, a) => a[i - 1] === '--run')
  if (!runId) throw new Error('usage: verify -- --run <run-id>')

  const runDir = resolve(ROOT, '.runs', runId)
  const draft = JSON.parse(await readFile(resolve(runDir, 'draft.json'), 'utf8')) as {
    prompt_version: string
    tasks: Task[]
  }

  const client = createClient()
  const template = await readFile(resolve(ROOT, 'prompts', 'verification.md'), 'utf8')

  const verified: Task[] = []

  for (const task of draft.tasks) {
    const verdicts = await Promise.all(
      Array.from({ length: SELF_CONSISTENCY_RUNS }, () =>
        solveOnce(client, template, task, MODELS.verifier),
      ),
    )

    const agreeing = verdicts.filter((v) => v.matches && v.unambiguous).length
    let verdict: Task['verification']['verdict']
    let model: string = MODELS.verifier
    let notes = verdicts.map((v) => v.notes).filter(Boolean).join(' | ')

    if (agreeing >= SELF_CONSISTENCY_THRESHOLD && agreeing === SELF_CONSISTENCY_RUNS) {
      verdict = 'pass'
    } else if (agreeing === 0) {
      verdict = 'fail'
    } else {
      // Split decision: the models disagree, so ask the adjudicator rather than
      // shipping a task whose answer or wording is genuinely contested.
      const adjudication = await solveOnce(client, template, task, MODELS.adjudicator)
      verdict = adjudication.verdict
      model = MODELS.adjudicator
      notes = `${notes} | adjudicated: ${adjudication.notes}`
    }

    verified.push({
      ...task,
      verification: {
        verdict,
        method: `self_consistency_${SELF_CONSISTENCY_RUNS}`,
        model,
        checked_at: new Date().toISOString(),
        notes: notes.slice(0, 2000),
      },
    })

    console.log(`[verify] ${task.id}: ${verdict} (${agreeing}/${SELF_CONSISTENCY_RUNS} согласны)`)
  }

  const passed = verified.filter((t) => t.verification.verdict === 'pass')
  for (const task of passed) TaskSchema.parse(task)

  await writeFile(
    resolve(runDir, 'verified.json'),
    JSON.stringify({ prompt_version: draft.prompt_version, tasks: verified }, null, 2),
  )

  console.log(
    `[verify] pass: ${passed.length}, fail: ${verified.filter((t) => t.verification.verdict === 'fail').length}, ` +
      `needs_review: ${verified.filter((t) => t.verification.verdict === 'needs_review').length}`,
  )
  console.log(`[verify] следующий шаг: pnpm --filter @olymp/pipeline publish -- --run ${runId} --version 1.0.0`)
}

await main()
