import { Link } from 'react-router'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { Bell, CheckCheck, Gift, MapPin, Shield, Skull, Swords, UserPlus, type LucideIcon } from 'lucide-react'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { apiPath } from '../../api/http.ts'
import { useCommand } from '../../api/useCommand.ts'
import { Button } from '../../components/Button.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { LoadProblem } from '../../components/LoadProblem.tsx'
import { formatAbsolute, formatRelative } from '../../lib/time.ts'
import { useNow } from '../../lib/useNow.ts'
import { useAuthenticated } from '../auth/sessionContext.ts'
import { notificationKeys, notificationSchema, readAllReceiptSchema, useInbox, type AppNotification, type ReadAllReceipt } from './api.ts'
import { deliveryLabel, presentNotification, type NotificationView } from './templates.ts'
import styles from './Notifications.module.css'

const ICONS: Record<NotificationView['kind'], LucideIcon> = {
  FRIEND_REQUEST: UserPlus,
  PLAYER_NEARBY: MapPin,
  BATTLE_REQUEST: Swords,
  TAMAGOTCHI_SHARED: Gift,
  GUILD_INVITATION: Shield,
  RAID_STARTED: Skull,
  OTHER: Bell,
}

type InboxPage = { items: AppNotification[]; next_cursor: string | null }

export default function NotificationsPage() {
  const { user } = useAuthenticated()
  const me = user.user_id
  const inbox = useInbox(me, { poll: true })
  const queryClient = useQueryClient()
  const now = useNow()
  const items = inbox.data?.pages.flatMap((page) => page.items) ?? []
  const unread = items.filter((item) => !item.read_at).length

  const readAll = useCommand<ReadAllReceipt>({
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.inbox(me) }),
  })
  const markRead = useCommand<AppNotification>({
    onSuccess: (response) =>
      queryClient.setQueryData<InfiniteData<InboxPage>>(notificationKeys.inbox(me), (data) =>
        data && { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map((item) => (item.id === response.data.id ? response.data : item)) })) },
      ),
  })
  const read = (notification: AppNotification) =>
    markRead.start({
      method: 'PATCH',
      path: apiPath`/notification/v1/notifications/${notification.id}`,
      body: { read: true },
      idempotent: false,
      parse: (value) => notificationSchema.parse(value),
      actor: me,
    })

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Notifications</h1>
          <p className={styles.lead}>Requests, challenges, invitations and raids that involve you. This list refreshes while it is open.</p>
        </div>
        <Button
          variant="secondary"
          icon={<CheckCheck size={18} aria-hidden="true" />}
          disabled={unread === 0 && !readAll.uncertain}
          busy={readAll.pending}
          onClick={() =>
            // The cut-off is fixed now; a retry replays this exact timestamp and key.
            readAll.start({
              method: 'POST',
              path: apiPath`/notification/v1/users/${me}/notifications/read-all`,
              body: { created_before: new Date().toISOString() },
              idempotent: true,
              parse: (value) => readAllReceiptSchema.parse(value),
              actor: me,
            })
          }
        >
          Mark all as read
        </Button>
      </header>

      {readAll.data && (
        <FormAlert title="Inbox updated." tone="info">
          {readAll.data.data.updated_count === 1 ? '1 notification was' : `${readAll.data.data.updated_count} notifications were`} marked as read.
        </FormAlert>
      )}
      {readAll.error && (
        <FormAlert title={readAll.uncertain ? 'We could not confirm the inbox was updated.' : 'Not marked as read.'} correlationId={isApiError(readAll.error) ? readAll.error.correlationId : null}>
          <p>{describeApiError(readAll.error)}</p>
          {readAll.uncertain && (
            <Button variant="quiet" onClick={readAll.retry}>
              Retry same request
            </Button>
          )}
        </FormAlert>
      )}
      {markRead.error && (
        <FormAlert title="Not marked as read." correlationId={isApiError(markRead.error) ? markRead.error.correlationId : null}>
          {describeApiError(markRead.error)}
        </FormAlert>
      )}

      {inbox.isError && inbox.data && (
        <FormAlert title="The inbox could not refresh." tone="info" correlationId={isApiError(inbox.error) ? inbox.error.correlationId : null}>
          {describeApiError(inbox.error)} Showing the last list; it retries while this page is open.
        </FormAlert>
      )}
      {inbox.isPending ? (
        <p className={styles.muted}>Loading notifications…</p>
      ) : inbox.isError && !inbox.data ? (
        <LoadProblem
          title="Notifications could not be loaded"
          message={describeApiError(inbox.error)}
          correlationId={isApiError(inbox.error) ? inbox.error.correlationId : null}
          onRetry={() => void inbox.refetch()}
          retrying={inbox.isFetching}
        />
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          <Bell size={28} aria-hidden="true" />
          <p>Nothing here yet. Friend requests, battle challenges, shared creatures, guild invitations and raid starts appear here.</p>
        </div>
      ) : (
        <ul className={styles.list} aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}>
          {items.map((item) => (
            <NotificationItem key={item.id} notification={item} view={presentNotification(item, now)} now={now} onRead={() => read(item)} busy={markRead.pending} />
          ))}
        </ul>
      )}
      {inbox.hasNextPage && (
        <Button variant="secondary" busy={inbox.isFetchingNextPage} onClick={() => void inbox.fetchNextPage()}>
          Load older notifications
        </Button>
      )}
    </main>
  )
}

function NotificationItem({ notification, view, now, onRead, busy }: { notification: AppNotification; view: NotificationView; now: number; onRead: () => void; busy: boolean }) {
  const Icon = ICONS[view.kind]
  const unread = !notification.read_at
  const delivery = deliveryLabel(notification.delivery_status)
  return (
    <li className={styles.item} data-unread={unread || undefined}>
      <span className={styles.icon} aria-hidden="true">
        <Icon size={20} />
      </span>
      <div className={styles.body}>
        <p className={styles.title}>
          {unread && <span className="visually-hidden">Unread: </span>}
          {view.title}
        </p>
        <p className={styles.meta}>
          <time dateTime={notification.created_at} title={formatAbsolute(notification.created_at)}>
            {formatRelative(notification.created_at, now)}
          </time>
          {view.detail && <> · {view.detail}</>}
          {delivery && <> · {delivery}</>}
        </p>
      </div>
      <div className={styles.actions}>
        {view.href && (
          <Link to={view.href} className={styles.open} onClick={() => unread && onRead()}>
            {view.linkLabel}
          </Link>
        )}
        {unread && (
          <Button variant="quiet" onClick={onRead} disabled={busy}>
            Mark read
          </Button>
        )}
      </div>
    </li>
  )
}
