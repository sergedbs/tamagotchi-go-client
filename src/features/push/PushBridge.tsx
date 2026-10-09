import { useEffect, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useConfig } from '../../app/configContext.ts'
import { useSession } from '../auth/sessionContext.ts'
import { notificationKeys } from '../notifications/api.ts'
import { inAppPath, OPEN_MESSAGE } from './envelope.ts'
import { ownerAction, readOwner, subscribeOwner, writeOwner } from './owner.ts'
import { listenForeground, releasePush } from './push.ts'

/**
 * App-wide push wiring without UI: notification clicks navigate an open tab
 * in-app, a subscription left by another player is released at sign-in, and the
 * owner's foreground pushes refresh the inbox.
 */
export function PushBridge() {
  const config = useConfig().push
  const session = useSession()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const owner = useSyncExternalStore(subscribeOwner, readOwner)
  const userId = session.status === 'authenticated' ? session.user.user_id : null

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const container = navigator.serviceWorker
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; href?: unknown } | null
      if (data?.type !== OPEN_MESSAGE || (event.origin && event.origin !== location.origin)) return
      void navigate(inAppPath(data.href))
    }
    container.addEventListener('message', onMessage)
    container.startMessages()
    return () => container.removeEventListener('message', onMessage)
  }, [navigate])

  useEffect(() => {
    if (!config || !userId || !('Notification' in window)) return
    const action = ownerAction(owner, userId, Notification.permission)
    if (action === 'release' && owner) {
      void releasePush(config).finally(() => {
        if (readOwner()?.user_id === owner.user_id) writeOwner(null)
      })
      return
    }
    if (action !== 'listen') return
    let active = true
    let stop: (() => void) | null = null
    listenForeground(config, () => void queryClient.invalidateQueries({ queryKey: notificationKeys.inbox(userId) })).then(
      (unsubscribe) => {
        if (active) stop = unsubscribe
        else unsubscribe()
      },
      () => undefined,
    )
    return () => {
      active = false
      stop?.()
    }
  }, [config, userId, owner, queryClient])

  return null
}
