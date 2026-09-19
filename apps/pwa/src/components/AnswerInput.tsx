import type { Answer } from '@olymp/schema'

/**
 * A choice task without visible choices is unanswerable, so the input shape
 * follows the answer type rather than always being a text box.
 *
 * Value is kept as a string for number/string/choice and as a string[] for
 * multi, matching what checkAnswer accepts.
 */
export function AnswerInput({
  answer,
  value,
  onChange,
  disabled = false,
  label = 'Твой ответ',
}: {
  answer: Answer
  value: string | string[]
  onChange: (next: string | string[]) => void
  disabled?: boolean
  label?: string
}) {
  if (answer.type === 'choice') {
    const selected = Array.isArray(value) ? value[0] : value
    return (
      <fieldset className="options" disabled={disabled}>
        <legend className="visually-hidden">{label}</legend>
        {answer.options.map((option) => (
          <label key={option} className={option === selected ? 'option option--on' : 'option'}>
            <input
              type="radio"
              name="answer"
              value={option}
              checked={option === selected}
              onChange={() => onChange(option)}
            />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>
    )
  }

  if (answer.type === 'multi') {
    const selected = Array.isArray(value) ? value : []
    const toggle = (option: string) =>
      onChange(
        selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option],
      )
    return (
      <fieldset className="options" disabled={disabled}>
        <legend className="options-legend">{label}: выбери все подходящие</legend>
        {answer.options.map((option) => (
          <label key={option} className={selected.includes(option) ? 'option option--on' : 'option'}>
            <input
              type="checkbox"
              value={option}
              checked={selected.includes(option)}
              onChange={() => toggle(option)}
            />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>
    )
  }

  return (
    <>
      <label className="visually-hidden" htmlFor="answer">
        {label}
      </label>
      <input
        id="answer"
        className="answer-input"
        value={Array.isArray(value) ? value.join(' ') : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        inputMode={answer.type === 'number' ? 'decimal' : 'text'}
        autoComplete="off"
        disabled={disabled}
      />
    </>
  )
}

/** True when the child has actually entered something to check. */
export function hasAnswer(value: string | string[]): boolean {
  return Array.isArray(value) ? value.length > 0 : value.trim() !== ''
}
