import { useSession } from '../auth/sessionContext.ts'
import { useInbox } from './api.ts'
import styles from './UnreadBadge.module.css'

function Count({ userId, part }: { userId: string; part: 'badge' | 'label' }) {
  const inbox = useInbox(userId)
  const items = inbox.data?.pages.flatMap((page) => page.items) ?? []
  const unread = items.filter((item) => !item.read_at).length
  if (unread === 0) return null
  // Only loaded pages are counted; a full unread page with more behind it reads "N+".
  const more = inbox.hasNextPage && unread === items.length
  const shown = unread > 9 ? '9+' : `${unread}${more ? '+' : ''}`
  if (part === 'label') return <>, {shown} unread</>
  return (
    <span className={styles.badge} aria-hidden="true">
      {shown}
    </span>
  )
}

/**
 * Unread count on the bell, from the same inbox query the Notifications screen
 * uses: the visible badge, or the text appended to the link's hidden label.
 */
export function UnreadBadge({ part = 'badge' }: { part?: 'badge' | 'label' }) {
  const session = useSession()
  if (session.status !== 'authenticated') return null
  return <Count userId={session.user.user_id} part={part} />
}
