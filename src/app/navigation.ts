import { Bell, CircleUserRound, Compass, PawPrint, ShieldCheck, Swords, UsersRound, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Additional path prefixes that keep this destination active. */
  match: string[]
}

export const DESTINATIONS: NavItem[] = [
  { to: '/creatures', label: 'Creatures', icon: PawPrint, match: ['/creatures', '/__preview/creatures'] },
  { to: '/explore', label: 'Explore', icon: Compass, match: ['/explore', '/players'] },
  { to: '/social', label: 'Social', icon: UsersRound, match: ['/social', '/guilds'] },
  { to: '/combat/battles', label: 'Combat', icon: Swords, match: ['/combat'] },
]

export const UTILITIES: NavItem[] = [
  { to: '/notifications', label: 'Notifications', icon: Bell, match: ['/notifications'] },
  { to: '/account', label: 'Account', icon: CircleUserRound, match: ['/account', '/credits'] },
]

/** Shown only when the session hints admin or package moderation; the server authorizes. */
export const ADMIN: NavItem = { to: '/admin/packages', label: 'Admin', icon: ShieldCheck, match: ['/admin'] }

export function isActive(item: NavItem, pathname: string): boolean {
  return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
