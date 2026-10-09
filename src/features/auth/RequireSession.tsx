import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from './sessionContext.ts'

export function RequireSession() {
  const session = useSession()
  const location = useLocation()
  if (session.status === 'authenticated') return <Outlet />
  if (session.reason === 'signed_out') return <Navigate to="/login" replace />
  const next = `${location.pathname}${location.search}`
  return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
}
