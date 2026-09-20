/** Longest preview that still fits two lines on a phone. */
const MAX_LENGTH = 120

function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[>*_`#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.?!])\s+/).filter((s) => s.trim() !== '')
}

function clamp(sentence: string): string {
  return sentence.length > MAX_LENGTH ? `${sentence.slice(0, MAX_LENGTH)}…` : sentence
}

/**
 * One line per task, picked so that rows differ from each other.
 *
 * Archive papers group several tasks under a shared opening — "Прочитайте
 * текст.", "На международной космической станции стояли электронные часы…" —
 * so taking the first sentence gave eight identical rows in a row, and the
 * list stopped telling a child which task they had already opened. The first
 * sentence that no sibling shares is the one that identifies the task.
 */
export function previews(statements: string[]): string[] {
  const parts = statements.map((md) => sentences(plainText(md)))

  const shared = new Map<string, number>()
  for (const part of parts) {
    for (const sentence of new Set(part)) {
      shared.set(sentence, (shared.get(sentence) ?? 0) + 1)
    }
  }

  // Tasks that differ only by their picture stay identical here; nothing in
  // the text can separate them, and the row number does.
  return parts.map((part) => clamp(part.find((s) => shared.get(s) === 1) ?? part[0] ?? ''))
}
