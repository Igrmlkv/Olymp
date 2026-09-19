import { useEffect, useState } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { getProfile } from './lib/profile.js'
import { flushTelemetry, track } from './lib/telemetry.js'
import { GradePickerScreen } from './screens/GradePickerScreen.js'
import { HomeScreen } from './screens/HomeScreen.js'
import { TopicScreen } from './screens/TopicScreen.js'
import { TaskScreen } from './screens/TaskScreen.js'
import { OlympiadScreen } from './screens/OlympiadScreen.js'
import { ParentScreen } from './screens/ParentScreen.js'
import type { Grade } from '@olymp/schema'

const router = createBrowserRouter([
  { path: '/', element: <HomeScreen /> },
  { path: '/grade', element: <GradePickerScreen /> },
  { path: '/:subject', element: <TopicScreen /> },
  { path: '/:subject/:topic', element: <TaskScreen /> },
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
      await track('app_open')
      await flushTelemetry()
    })()
  }, [])

  if (grade === undefined) {
    return <p className="screen">Загружаем…</p>
  }

  if (grade === null) {
    return <GradePickerScreen onPicked={setGrade} />
  }

  return <RouterProvider router={router} />
}
