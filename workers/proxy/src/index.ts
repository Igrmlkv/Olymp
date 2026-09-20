import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { GradeSchema, SubjectSchema, TelemetryBatchSchema, packageKey } from '@olymp/schema'
import { callAnthropic, estimateCostUsd } from './anthropic.js'
import type { Env } from './types.js'

const app = new Hono<{ Bindings: Env }>()

app.use('/api/*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'] }))

app.get('/api/health', (c) => c.json({ ok: true, environment: c.env.ENVIRONMENT }))

/**
 * Serves a published content package from R2. Packages are immutable per
 * version, so they are cached hard on the client; `latest.json` is a pointer
 * object rewritten on publish.
 */
app.get('/api/packages/:subject/:grade/:version', async (c) => {
  const subject = SubjectSchema.safeParse(c.req.param('subject'))
  const grade = GradeSchema.safeParse(Number(c.req.param('grade')))
  if (!subject.success || !grade.success) return c.json({ error: 'bad request' }, 400)

  const version = c.req.param('version').replace(/\.json$/, '')
  const object = await c.env.PACKAGES.get(packageKey(subject.data, grade.data, version))
  if (!object) return c.json({ error: 'package not found' }, 404)

  return new Response(object.body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // `latest` must stay revalidated; a pinned version never changes.
      'cache-control': version === 'latest' ? 'public, max-age=300' : 'public, max-age=31536000, immutable',
    },
  })
})

/**
 * Anonymised telemetry. Deliberately does NOT read CF-Connecting-IP or any
 * geo header: storing them would defeat the minimisation the privacy policy
 * promises. See docs/legal/pre-dpia.md.
 */
app.post('/api/telemetry', async (c) => {
  const parsed = TelemetryBatchSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'invalid telemetry batch' }, 400)

  for (const event of parsed.data.events) {
    c.env.TELEMETRY.writeDataPoint({
      blobs: [event.name, event.subject ?? '', event.topic ?? '', event.task_id ?? ''],
      doubles: [event.grade ?? 0, event.level ?? 0, event.attempt_count ?? 0, event.duration_ms ?? 0],
      indexes: [event.installation_id],
    })
  }

  return c.json({ accepted: parsed.data.events.length })
})

const HintRequestSchema = z.object({
  task_id: z.string().min(1),
  statement: z.string().min(1).max(4000),
  hint_level: z.number().int().min(1).max(3),
})

/**
 * Live hint rephrasing. The request carries the task text only — no name, no
 * progress, no installation id — which is what keeps personal data out of
 * prompts sent to a non-EU inference region.
 */
app.post('/api/hint', async (c) => {
  const parsed = HintRequestSchema.safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'invalid hint request' }, 400)

  const model = c.env.MODEL_HINTS
  const result = await callAnthropic(c.env, {
    model,
    max_tokens: 300,
    system:
      'Ты помогаешь ребёнку 10 лет решать задачу. Дай ОДНУ подсказку указанного уровня на русском языке. ' +
      'Никогда не называй итоговый ответ. Уровень 1 — направление мысли, 2 — первый шаг, 3 — почти весь путь.',
    messages: [
      {
        role: 'user',
        content: `Задача:\n${parsed.data.statement}\n\nУровень подсказки: ${parsed.data.hint_level}`,
      },
    ],
  })

  // The model has already answered; the audit row must not hold the response.
  c.executionCtx.waitUntil(
    logProxyRequest(c.env, {
      route: '/api/hint',
      model,
      status: result.status,
      latencyMs: result.latencyMs,
      usage: result.usage,
    }),
  )

  if (result.status !== 200) return c.json({ error: 'upstream error' }, 502)
  return c.json(result.body)
})

interface ProxyLogEntry {
  route: string
  model: string
  status: number
  latencyMs: number
  usage: { input_tokens: number; output_tokens: number } | null
}

/** Cost/latency audit trail, reconciled against the Anthropic Admin API. */
async function logProxyRequest(env: Env, entry: ProxyLogEntry): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO proxy_requests
         (route, model, status, latency_ms, input_tokens, output_tokens, cost_usd, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
      .bind(
        entry.route,
        entry.model,
        entry.status,
        entry.latencyMs,
        entry.usage?.input_tokens ?? null,
        entry.usage?.output_tokens ?? null,
        estimateCostUsd(entry.model, entry.usage),
      )
      .run()
  } catch (cause) {
    // Logging must never take down a request a child is waiting on.
    console.error('proxy log failed', cause)
  }
}

export default app
