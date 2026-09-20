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
const TopicScreen = lazy(() => import('./screens/TopicScreen.js'))
const TaskListScreen = lazy(() => import('./screens/TaskListScreen.js'))
const TaskScreen = lazy(() => import('./screens/TaskScreen.js'))
const OlympiadScreen = lazy(() => import('./screens/OlympiadScreen.js'))
const ParentScreen = lazy(() => import('./screens/ParentScreen.js'))

function Loading() {
  return <p className="screen">Загружаем…</p>
}

const router = createBrowserRouter([
  { path: '/', element: <HomeScreen /> },
  { path: '/grade', element: <GradePickerScreen /> },
  { path: '/:subject', element: <TopicScreen /> },
  { path: '/:subject/:topic', element: <TaskListScreen /> },
  { path: '/:subject/:topic/:taskId', element: <TaskScreen /> },
  { path: '/olympiad/:subject', element: <OlympiadScreen /> },
  { path: '/parents', element: <ParentScreen /> },
  { path: '*', element: <Navigate to="/" replace /> },
])

export function App() {
  const [grade, setGrade] = useState<Grade | null | undefined>(undefined)

  useEffect(() => {
    void (async () => {
      const profile = await getProfile()
      setGrade(profile.grade)
      void track('app_open')
      // Not awaited: a network round trip must not sit on the startup path
      // ahead of the first route chunk and the content package.
      void flushTelemetry()
    })()
  }, [])

  if (grade === undefined) return <Loading />
  if (grade === null) return <GradePickerScreen onPicked={setGrade} />

  // Routes are full-screen, so one boundary gives the same granularity as four.
  return (
    <Suspense fallback={<Loading />}>
      <RouterProvider router={router} />
    </Suspense>
  )
}
