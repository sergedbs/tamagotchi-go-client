/**
 * Push service worker, bundled with Firebase by Vite (a classic script in
 * builds). Its scope is its own folder, so it never controls pages: it only
 * receives pushes and handles clicks. The public Firebase Web configuration
 * arrives in its URL query; nothing is stored here.
 */
import { initializeApp } from 'firebase/app'
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw'
import { firebaseWebConfigSchema } from '../../app/config.ts'
import { inAppPath, OPEN_MESSAGE, pushView } from './envelope.ts'

// Minimal service worker types; the app compiles against the DOM library.
interface WaitableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void
}
interface ClickEvent extends WaitableEvent {
  readonly notification: Notification
}
interface AppWindow {
  readonly url: string
  readonly focused: boolean
  focus(): Promise<AppWindow>
  postMessage(message: unknown): void
}
interface WorkerScope {
  readonly location: Location
  readonly registration: ServiceWorkerRegistration
  readonly clients: {
    matchAll(options: { type: 'window'; includeUncontrolled: boolean }): Promise<AppWindow[]>
    openWindow(url: string): Promise<AppWindow | null>
  }
  skipWaiting(): Promise<void>
  addEventListener(type: 'install', listener: (event: WaitableEvent) => void): void
  addEventListener(type: 'notificationclick', listener: (event: ClickEvent) => void): void
}
declare const self: WorkerScope

self.addEventListener('install', (event) => event.waitUntil(self.skipWaiting()))

// Registered before Firebase, which ignores notifications it did not create.
self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data as { href?: unknown } | null
  event.notification.close()
  event.waitUntil(openApp(inAppPath(data?.href)))
})

async function openApp(href: string) {
  const windows = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter(
    (client) => new URL(client.url).origin === self.location.origin,
  )
  const app = windows.find((client) => client.focused) ?? windows[0]
  if (app) {
    // In-app navigation keeps the open tab's memory-only session.
    await app.focus()
    app.postMessage({ type: OPEN_MESSAGE, href })
    return
  }
  // A new tab signs in first and then continues to href.
  await self.clients.openWindow(href)
}

function readConfig() {
  try {
    return firebaseWebConfigSchema.parse(JSON.parse(new URL(self.location.href).searchParams.get('firebase') ?? ''))
  } catch {
    return null
  }
}

// Firebase must attach its push listener during this first evaluation.
const config = readConfig()
if (config) {
  onBackgroundMessage(getMessaging(initializeApp(config)), (payload) => {
    // Provider-built notifications are displayed by Firebase itself.
    if (payload.notification) return
    const view = pushView(payload.data, Date.now())
    return self.registration.showNotification(view.title, { body: view.body, tag: view.tag, data: { href: view.href } })
  })
}
