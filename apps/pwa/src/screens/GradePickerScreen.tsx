import { GRADE_MAPPING, GRADES, SHIPPED_GRADES, type Grade } from '@olymp/schema'
import { setGrade } from '../lib/profile.js'

/**
 * First screen a child sees. The Dutch hint ("4 класс ≈ groep 6") matters:
 * children here know their groep, not their Russian grade.
 */
export function GradePickerScreen({ onPicked }: { onPicked?: (grade: Grade) => void }) {
  async function pick(grade: Grade) {
    await setGrade(grade)
    onPicked?.(grade)
  }

  return (
    <main className="screen">
      <h1>В каком ты классе?</h1>
      <p className="muted">Подсказка показывает, какой это класс в нидерландской школе.</p>

      <ul className="grade-list">
        {GRADES.map((grade) => {
          const shipped = (SHIPPED_GRADES as readonly number[]).includes(grade)
          return (
            <li key={grade}>
              <button className="grade-button" disabled={!shipped} onClick={() => void pick(grade)}>
                <span className="grade-number">{grade} класс</span>
                <span className="muted">{GRADE_MAPPING[grade].hint_ru}</span>
                {!shipped && <span className="badge">скоро</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </main>
  )
}

export default GradePickerScreen
