import { useEffect, useState } from 'react'
import type { ContentPackage, Subject } from '@olymp/schema'
import { ensurePackage } from './content.js'
import { getProfile } from './profile.js'

export type PackageState =
  | { status: 'loading' }
  | { status: 'no-grade' }
  | { status: 'ready'; pkg: ContentPackage }
  | { status: 'error'; message: string }

/**
 * Loading a subject's package for the child's grade. All three content screens
 * did this by hand before, and had already drifted: only one of them caught the
 * error, so a failed download left the other two on "задачи ещё не загружены"
 * forever — a message about content, shown for a network failure.
 */
export function usePackage(subject: Subject | null): PackageState {
  const [state, setState] = useState<PackageState>({ status: 'loading' })

  useEffect(() => {
    if (subject === null) return
    let cancelled = false

    void (async () => {
      try {
        const profile = await getProfile()
        if (cancelled) return
        if (!profile.grade) return setState({ status: 'no-grade' })

        const stored = await ensurePackage(subject, profile.grade)
        if (!cancelled) setState({ status: 'ready', pkg: stored.payload })
      } catch (cause) {
        if (cancelled) return
        setState({
          status: 'error',
          message: cause instanceof Error ? cause.message : 'неизвестная ошибка',
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [subject])

  return state
}
