import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AppShell } from './AppShell.tsx'
import { NotFound } from './NotFound.tsx'
import { NotInThisBuild } from './NotInThisBuild.tsx'

const CreditsPage = lazy(() => import('../features/credits/CreditsPage.tsx'))

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/creatures" replace />} />
          <Route path="creatures" element={<NotInThisBuild title="Creatures" />} />
          <Route path="explore" element={<NotInThisBuild title="Explore" />} />
          <Route path="social" element={<NotInThisBuild title="Social" />} />
          <Route path="combat/*" element={<NotInThisBuild title="Combat" />} />
          <Route path="notifications" element={<NotInThisBuild title="Notifications" />} />
          <Route path="account" element={<NotInThisBuild title="Account" />} />
          <Route path="credits" element={<CreditsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
