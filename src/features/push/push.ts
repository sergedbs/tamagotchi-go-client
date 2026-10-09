import type { PushConfig } from '../../app/config.ts'
import workerUrl from './sw.ts?worker&url'

/**
 * Browser side of Firebase Cloud Messaging. Firebase is loaded only here, on
 * demand. The device token is returned to the registration call and never
 * shown, logged or stored by the client.
 */
export type PushSupport = 'unconfigured' | 'unsupported' | NotificationPermission

export class PushSetupError extends Error {
  readonly reason: 'denied' | 'dismissed' | 'failed'
  /** A provider error code such as messaging/token-subscribe-failed, never a token. */
  readonly code: string | null

  constructor(reason: 'denied' | 'dismissed' | 'failed', code: string | null = null) {
    super(`Push setup ${reason}${code ? ` (${code})` : ''}`)
    this.name = 'PushSetupError'
    this.reason = reason
    this.code = code
  }
}

async function loadMessaging(config: PushConfig) {
  const [{ getApps, initializeApp }, messaging] = await Promise.all([import('firebase/app'), import('firebase/messaging')])
  const app = getApps()[0] ?? initializeApp(config.firebase)
  return { ...messaging, messaging: messaging.getMessaging(app) }
}

export async function pushSupport(config: PushConfig | null): Promise<PushSupport> {
  if (!config) return 'unconfigured'
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  const { isSupported } = await import('firebase/messaging')
  if (!(await isSupported().catch(() => false))) return 'unsupported'
  return Notification.permission
}

function scriptUrl(config: PushConfig): string {
  const url = new URL(workerUrl, location.origin)
  url.searchParams.set('firebase', JSON.stringify(config.firebase))
  return url.href
}

/** The worker's own folder: it receives pushes but never controls pages. */
const workerScope = () => new URL('./', new URL(workerUrl, location.origin)).href

function activation(registration: ServiceWorkerRegistration): Promise<void> {
  const worker = registration.installing ?? registration.waiting
  if (registration.active || !worker) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const check = () => {
      if (worker.state === 'activated') resolve()
      else if (worker.state === 'redundant') reject(new PushSetupError('failed', 'worker-redundant'))
    }
    worker.addEventListener('statechange', check)
    check()
  })
}

async function registerWorker(config: PushConfig): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register(scriptUrl(config), {
    type: import.meta.env.DEV ? 'module' : 'classic',
    updateViaCache: 'none',
  })
  await activation(registration)
  return registration
}

const errorCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code.slice(0, 80) : null

/** Call directly from a click: the permission prompt comes first. */
export async function requestPushToken(config: PushConfig): Promise<string> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new PushSetupError(permission === 'denied' ? 'denied' : 'dismissed')
  try {
    const registration = await registerWorker(config)
    const { messaging, getToken } = await loadMessaging(config)
    const token = await getToken(messaging, { vapidKey: config.vapid_key, serviceWorkerRegistration: registration })
    if (!token) throw new PushSetupError('failed', 'no-token')
    return token
  } catch (error) {
    throw error instanceof PushSetupError ? error : new PushSetupError('failed', errorCode(error))
  }
}

/**
 * Ends delivery to this browser: deletes the FCM token, then the push
 * subscription and the worker. Local unsubscription alone already stops
 * delivery, so provider failures are not fatal.
 */
export async function releasePush(config: PushConfig | null): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration(workerScope()).catch(() => undefined)
  if (!registration) return
  if (config && Notification.permission === 'granted') {
    try {
      const { messaging, getToken, deleteToken } = await loadMessaging(config)
      // Binds this registration (no prompt: permission is granted) so deleteToken targets it.
      await getToken(messaging, { vapidKey: config.vapid_key, serviceWorkerRegistration: registration })
      await deleteToken(messaging)
    } catch {
      // Continue with the local unsubscription.
    }
  }
  const subscription = await registration.pushManager.getSubscription().catch(() => null)
  await subscription?.unsubscribe().catch(() => false)
  await registration.unregister().catch(() => false)
}

/** Foreground pushes for a visible app arrive here instead of as system notifications. */
export async function listenForeground(config: PushConfig, onPush: () => void): Promise<() => void> {
  // Re-registering picks up a worker from a newer build.
  await registerWorker(config)
  const { messaging, onMessage } = await loadMessaging(config)
  return onMessage(messaging, () => onPush())
}
