import Anthropic from '@anthropic-ai/sdk'

export function createClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set — copy pipeline/.env.example to pipeline/.env')
  }
  return new Anthropic({ apiKey })
}

/** Pulls the first JSON object or array out of a model response. */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced?.[1] ?? text
  const start = candidate.search(/[[{]/)
  if (start === -1) throw new Error('no JSON found in model response')
  return JSON.parse(candidate.slice(start)) as T
}

/** Concatenates the text blocks of a response, skipping thinking blocks. */
export function textFrom(response: Anthropic.Message): string {
  return response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n')
}
