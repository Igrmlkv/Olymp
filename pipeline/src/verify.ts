import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { z } from 'zod'
import { summariseVerdicts, TaskSchema, type Task } from '@olymp/schema'
import type Anthropic from '@anthropic-ai/sdk'
import { createClient, extractJson, textFrom } from './anthropic-client.js'
import { requireArg } from './args.js'
import { PROMPTS_DIR, runDir } from './paths.js'
import { MODELS, SELF_CONSISTENCY_RUNS, VERIFY_CONCURRENCY } from './models.js'

/**
 * Independent verification pass. Each task is solved from scratch several times;
 * it only passes when every run both agrees on the answer AND finds the wording
 * unambiguous. Split decisions go to the adjudicator model rather than being
 * resolved by a majority vote.
 *
 * Usage: pnpm --filter @olymp/pipeline verify -- --run <run-id>
 */

const VerdictSchema = z.object({
  own_answer: z.string(),
  matches: z.boolean(),
  unambiguous: z.boolean(),
  verdict: z.enum(['pass', 'fail', 'needs_review']),
  notes: z.string().default(''),
})
type Verdict = z.infer<typeof VerdictSchema>

async function solveOnce(
  client: Anthropic,
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

  return VerdictSchema.parse(extractJson(textFrom(response)))
}

async function verifyTask(client: Anthropic, template: string, task: Task): Promise<Task> {
  const verdicts = await Promise.all(
    Array.from({ length: SELF_CONSISTENCY_RUNS }, () =>
      solveOnce(client, template, task, MODELS.verifier),
    ),
  )

  const agreeing = verdicts.filter((v) => v.matches && v.unambiguous).length
  let verdict: Task['verification']['verdict']
  let model: string = MODELS.verifier
  let notes = verdicts.map((v) => v.notes).filter(Boolean).join(' | ')

  if (agreeing === SELF_CONSISTENCY_RUNS) {
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

  console.log(`[verify] ${task.id}: ${verdict} (${agreeing}/${SELF_CONSISTENCY_RUNS} согласны)`)

  return {
    ...task,
    verification: {
      verdict,
      method: `self_consistency_${SELF_CONSISTENCY_RUNS}`,
      model,
      checked_at: new Date().toISOString(),
      notes: notes.slice(0, 2000),
    },
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size))
  return batches
}

async function main(): Promise<void> {
  const runId = requireArg('run', 'usage: verify -- --run <run-id>')
  const dir = runDir(runId)

  const draft = JSON.parse(await readFile(resolve(dir, 'draft.json'), 'utf8')) as {
    prompt_version: string
    tasks: Task[]
  }

  const client = createClient()
  const template = await readFile(resolve(PROMPTS_DIR, 'verification.md'), 'utf8')

  // Tasks are independent, so they verify in parallel — but in a bounded pool,
  // not all at once: each task already fires SELF_CONSISTENCY_RUNS requests, and
  // an unbounded fan-out over a whole package walks into a rate limit.
  const verified: Task[] = []
  for (const batch of chunk(draft.tasks, VERIFY_CONCURRENCY)) {
    verified.push(...(await Promise.all(batch.map((task) => verifyTask(client, template, task)))))
  }

  for (const task of verified.filter((t) => t.verification.verdict === 'pass')) {
    TaskSchema.parse(task)
  }

  await writeFile(
    resolve(dir, 'verified.json'),
    JSON.stringify({ prompt_version: draft.prompt_version, tasks: verified }, null, 2),
  )

  const summary = summariseVerdicts(verified)
  console.log(
    `[verify] pass: ${summary.passed}, fail: ${summary.failed}, needs_review: ${summary.needs_review}`,
  )
  console.log(`[verify] следующий шаг: pnpm --filter @olymp/pipeline publish -- --run ${runId} --version 1.0.0`)
}

await main()
