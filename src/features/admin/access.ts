import { usePublicPackages } from '../auth/packagesApi.ts'
import { useSession } from '../auth/sessionContext.ts'

/**
 * Navigation hint only: the admin role claim or package moderation. Every admin
 * action is still authorized by the server.
 */
export function useAdminAccess() {
  const session = useSession()
  const packages = usePublicPackages()
  if (session.status !== 'authenticated') return { visible: false, isAdmin: false, moderated: [] as string[] }
  const me = session.user.user_id
  const isAdmin = session.roles.includes('admin')
  const moderated = (packages.data?.items ?? []).filter((pkg) => pkg.moderator_user_ids.includes(me)).map((pkg) => pkg.package_id)
  return { visible: isAdmin || moderated.length > 0, isAdmin, moderated }
}
