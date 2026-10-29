import { z } from 'zod'
import { isUuid } from '../../api/uuid.ts'
import { presentNotification } from '../notifications/templates.ts'

/** Where a push opens when it carries no usable destination. */
export const INBOX_PATH = '/notifications'

/** Worker-to-page message asking an open tab to navigate in-app. */
export const OPEN_MESSAGE = 'tamagotchi-go/push-open'

const paramsSchema = z.record(z.string().max(64), z.union([z.string().max(512), z.number(), z.boolean()]))

/**
 * The FCM data envelope sent by the Notification service: the template type, the
 * inbox record's ID and its parameters as a JSON string. Never trusted markup.
 */
const envelopeSchema = z.object({
  type: z.string().min(1).max(64),
  notification_id: z.string().refine(isUuid),
  params: z
    .string()
    .max(4096)
    .transform((value, ctx) => {
      try {
        return JSON.parse(value) as unknown
      } catch {
        ctx.addIssue({ code: 'custom', message: 'params is not JSON' })
        return z.NEVER
      }
    })
    .pipe(paramsSchema),
})

export interface PushEnvelope {
  type: string
  notificationId: string
  params: z.output<typeof paramsSchema>
}

export function parsePushData(data: unknown): PushEnvelope | null {
  const result = envelopeSchema.safeParse(data)
  if (!result.success) return null
  return { type: result.data.type, notificationId: result.data.notification_id.toLowerCase(), params: result.data.params }
}

export interface PushView {
  title: string
  body: string
  /** In-app path to open on click. */
  href: string
  /** The inbox notification ID; repeats of one notification replace each other. */
  tag: string | undefined
}

/** Builds the system notification from the same templates as the inbox. */
export function pushView(data: unknown, now: number): PushView {
  const envelope = parsePushData(data)
  if (!envelope) return { title: 'New notification', body: 'Tamagotchi Go', href: INBOX_PATH, tag: undefined }
  const view = presentNotification({ type: envelope.type, params: envelope.params }, now)
  return { title: view.title, body: view.detail ?? 'Tamagotchi Go', href: inAppPath(view.href), tag: envelope.notificationId }
}

/** Only same-app paths are opened from a notification; anything else opens the inbox. */
export function inAppPath(value: unknown): string {
  if (typeof value !== 'string' || value.length > 512) return INBOX_PATH
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return INBOX_PATH
  const base = 'https://app.invalid'
  try {
    const url = new URL(value, base)
    return url.origin === base ? `${url.pathname}${url.search}` : INBOX_PATH
  } catch {
    return INBOX_PATH
  }
}
