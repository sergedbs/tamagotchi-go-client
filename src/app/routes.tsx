import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AuthLayout } from '../features/auth/AuthLayout.tsx'
import LoginPage from '../features/auth/LoginPage.tsx'
import { RequireSession } from '../features/auth/RequireSession.tsx'
import { AppShell } from './AppShell.tsx'
import { NotFound } from './NotFound.tsx'
import { NotInThisBuild } from './NotInThisBuild.tsx'
import { ShellOrPublic } from './PublicFrame.tsx'

const RegisterPage = lazy(() => import('../features/auth/RegisterPage.tsx'))
const AccountPage = lazy(() => import('../features/account/AccountPage.tsx'))
const CreaturesPage = lazy(() => import('../features/creatures/CreaturesPage.tsx'))
const CreatureDetailPage = lazy(() => import('../features/creatures/detail/CreatureDetailPage.tsx'))
const ExplorePage = lazy(() => import('../features/explore/ExplorePage.tsx'))
const CreditsPage = lazy(() => import('../features/credits/CreditsPage.tsx'))

// Design preview: compiled into development builds only.
const CreaturePreview = import.meta.env.DEV ? lazy(() => import('../features/creatures/preview/CreaturePreview.tsx')) : null

export function AppRoutes() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>
        <Route element={<RequireSession />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/creatures" replace />} />
            <Route path="creatures" element={<CreaturesPage />} />
            <Route path="creatures/:id" element={<CreatureDetailPage />} />
            <Route path="explore" element={<ExplorePage />} />
            <Route path="social" element={<NotInThisBuild title="Social" />} />
            <Route path="combat/*" element={<NotInThisBuild title="Combat" />} />
            <Route path="notifications" element={<NotInThisBuild title="Notifications" />} />
            <Route path="account" element={<AccountPage />} />
          </Route>
        </Route>
        <Route element={<ShellOrPublic />}>
          <Route path="credits" element={<CreditsPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        {CreaturePreview && (
          <Route element={<AppShell />}>
            <Route path="__preview/creatures" element={<CreaturePreview />} />
          </Route>
        )}
      </Routes>
    </Suspense>
  )
}
