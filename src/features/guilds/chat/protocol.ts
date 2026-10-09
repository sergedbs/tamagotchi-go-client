import { z } from 'zod'

export const chatMessageSchema = z.object({
  message_id: z.string(),
  guild_id: z.string(),
  author_id: z.string(),
  client_message_id: z.string(),
  content: z.string(),
  timestamp: z.string(),
})
export type ChatMessage = z.output<typeof chatMessageSchema>
export const chatPageSchema = z.object({ items: z.array(chatMessageSchema), next_cursor: z.string().nullable() })

export const wsTicketSchema = z.object({ url: z.string().min(1).max(2048), ticket: z.string().min(1), expires_at: z.string() })
export type WsTicket = z.output<typeof wsTicketSchema>

const frameSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready'), guild_id: z.string(), user_id: z.string(), expires_at: z.string() }),
  z.object({ type: z.literal('ack'), client_message_id: z.string(), message_id: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal('message'), message: chatMessageSchema }),
  z.object({ type: z.literal('error'), code: z.string(), detail: z.string(), client_message_id: z.string().optional() }),
])
export type ServerFrame = z.output<typeof frameSchema>

/** Unknown or malformed frames are ignored rather than crashing the chat. */
export function parseFrame(data: unknown): ServerFrame | null {
  if (typeof data !== 'string') return null
  try {
    const result = frameSchema.safeParse(JSON.parse(data))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export const CLOSE_TICKET_REFUSED = 4401
export const CLOSE_NOT_MEMBER = 4403

/** Bounded reconnect: 1/2/4/8/15 s with jitter; after that the user reconnects. */
export const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15_000]

export function reconnectDelay(attempt: number, random: () => number = Math.random): number | null {
  const base = RECONNECT_DELAYS_MS[attempt]
  if (base === undefined) return null
  return Math.round(base * (1 + random() * 0.3))
}

/**
 * The negotiated URL must be a ws/wss URL on an explicitly allowed origin and
 * the documented chat path for this guild; https pages require wss.
 */
export function validateSocketUrl(raw: string, guildId: string, allowedOrigins: string[], pageProtocol: string): string | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return null
  if (pageProtocol === 'https:' && url.protocol !== 'wss:') return null
  if (url.username || url.password || url.search || url.hash) return null
  if (!allowedOrigins.includes(url.origin)) return null
  if (!url.pathname.endsWith(`/v1/guilds/${guildId}/chat`)) return null
  return url.href
}
