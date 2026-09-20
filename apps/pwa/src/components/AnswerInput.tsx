import { useId } from 'react'
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
  // Olympiad mode renders one of these per task. A shared id/name would put
  // every task's radios in the same group, so choosing an answer to task 3
  // would clear task 1.
  const id = useId()

  if (answer.type === 'choice' || answer.type === 'multi') {
    const multiple = answer.type === 'multi'
    const selected = Array.isArray(value) ? value : value === '' ? [] : [value]
    const toggle = (option: string) => {
      if (!multiple) return onChange(option)
      onChange(
        selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option],
      )
    }

    return (
      <fieldset className="options" disabled={disabled}>
        <legend className={multiple ? 'options-legend' : 'visually-hidden'}>
          {multiple ? `${label}: выбери все подходящие` : label}
        </legend>
        {answer.options.map((option) => (
          <label
            key={option}
            className={selected.includes(option) ? 'option option--on' : 'option'}
          >
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={id}
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

  if (answer.type === 'parts') {
    const values = Array.isArray(value) ? value : []
    return (
      <fieldset className="options parts" disabled={disabled}>
        <legend className="options-legend">{label}</legend>
        {answer.labels.map((partLabel, i) => (
          <label key={partLabel} className="part">
            <span className="part-label">{partLabel}</span>
            <input
              className="answer-input"
              value={values[i] ?? ''}
              autoComplete="off"
              onChange={(e) => {
                const next = answer.labels.map((_, j) => values[j] ?? '')
                next[i] = e.target.value
                onChange(next)
              }}
            />
          </label>
        ))}
      </fieldset>
    )
  }

  return (
    <>
      <label className="visually-hidden" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
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
  // A parts answer is only ready once every blank has something in it.
  return Array.isArray(value)
    ? value.length > 0 && value.every((v) => v.trim() !== '')
    : value.trim() !== ''
}
