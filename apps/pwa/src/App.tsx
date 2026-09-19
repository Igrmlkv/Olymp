import { lazy, Suspense, useEffect, useState } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { getProfile } from './lib/profile.js'
import { flushTelemetry, track } from './lib/telemetry.js'
import { GradePickerScreen } from './screens/GradePickerScreen.js'
import { HomeScreen } from './screens/HomeScreen.js'
import type { Grade } from '@olymp/schema'

/**
 * The grade picker and the home screen load eagerly — they are the first thing
 * a child sees. Everything that pulls in the Markdown renderer is split out, so
 * the first paint does not wait on a parser it has no use for yet.
 *
 * Offline is unaffected: the service worker precaches every emitted chunk.
 */
const TopicScreen = lazy(async () => ({ default: (await import('./screens/TopicScreen.js')).TopicScreen }))
const TaskScreen = lazy(async () => ({ default: (await import('./screens/TaskScreen.js')).TaskScreen }))
const OlympiadScreen = lazy(async () => ({
  default: (await import('./screens/OlympiadScreen.js')).OlympiadScreen,
}))
const ParentScreen = lazy(async () => ({ default: (await import('./screens/ParentScreen.js')).ParentScreen }))

function Loading() {
  return <p className="screen">Загружаем…</p>
}

function lazyRoute(element: React.ReactNode) {
  return <Suspense fallback={<Loading />}>{element}</Suspense>
}

const router = createBrowserRouter([
  { path: '/', element: <HomeScreen /> },
  { path: '/grade', element: <GradePickerScreen /> },
  { path: '/:subject', element: lazyRoute(<TopicScreen />) },
  { path: '/:subject/:topic', element: lazyRoute(<TaskScreen />) },
  { path: '/olympiad/:subject', element: lazyRoute(<OlympiadScreen />) },
  { path: '/parents', element: lazyRoute(<ParentScreen />) },
  { path: '*', element: <Navigate to="/" replace /> },
])

export function App() {
  const [grade, setGrade] = useState<Grade | null | undefined>(undefined)

  useEffect(() => {
    void (async () => {
      const profile = await getProfile()
      setGrade(profile.grade)
      await track('app_open')
      await flushTelemetry()
    })()
  }, [])

  if (grade === undefined) {
    return <Loading />
  }

  if (grade === null) {
    return <GradePickerScreen onPicked={setGrade} />
  }

  return <RouterProvider router={router} />
}
