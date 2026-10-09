import { parseTime } from '../../../lib/time.ts'
import type { ChatMessage } from './protocol.ts'

export interface PendingMessage {
  client_message_id: string
  content: string
  author_id: string
  /** sending: frame sent, no ack yet. unconfirmed: connection dropped first. failed: server error frame. */
  status: 'sending' | 'unconfirmed' | 'failed'
  error?: string
  created: number
}

export interface ChatState {
  messages: Record<string, ChatMessage>
  pending: Record<string, PendingMessage>
  /** client_message_id values already confirmed, so late duplicates never reappear as pending. */
  confirmed: Record<string, string>
}

export type ChatAction =
  | { type: 'history'; items: ChatMessage[] }
  | { type: 'message'; message: ChatMessage }
  | { type: 'ack'; client_message_id: string; message_id: string; timestamp: string }
  | { type: 'sending'; pending: PendingMessage }
  | { type: 'failed'; client_message_id: string; error: string }
  | { type: 'disconnected' }

export const initialChat: ChatState = { messages: {}, pending: {}, confirmed: {} }

function confirm(state: ChatState, message: ChatMessage): ChatState {
  const pending = { ...state.pending }
  delete pending[message.client_message_id]
  return {
    messages: { ...state.messages, [message.message_id]: message },
    pending,
    confirmed: { ...state.confirmed, [message.client_message_id]: message.message_id },
  }
}

/** Ack and broadcast can arrive in either order; one bubble per message_id. */
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'history':
      return action.items.reduce(confirm, state)
    case 'message':
      return confirm(state, action.message)
    case 'ack': {
      const pending = state.pending[action.client_message_id]
      if (!pending) return { ...state, confirmed: { ...state.confirmed, [action.client_message_id]: action.message_id } }
      if (state.messages[action.message_id]) return confirm(state, state.messages[action.message_id]!)
      return confirm(state, {
        message_id: action.message_id,
        guild_id: '',
        author_id: pending.author_id,
        client_message_id: action.client_message_id,
        content: pending.content,
        timestamp: action.timestamp,
      })
    }
    case 'sending':
      if (state.confirmed[action.pending.client_message_id]) return state
      return { ...state, pending: { ...state.pending, [action.pending.client_message_id]: action.pending } }
    case 'failed': {
      const pending = state.pending[action.client_message_id]
      if (!pending) return state
      return { ...state, pending: { ...state.pending, [action.client_message_id]: { ...pending, status: 'failed', error: action.error } } }
    }
    case 'disconnected': {
      const pending = Object.fromEntries(
        Object.entries(state.pending).map(([id, item]) => [id, item.status === 'sending' ? { ...item, status: 'unconfirmed' as const } : item]),
      )
      return { ...state, pending }
    }
  }
}

/** Confirmed messages by server time (then id), followed by local pending ones. */
export function timeline(state: ChatState): { confirmed: ChatMessage[]; pending: PendingMessage[] } {
  const confirmed = Object.values(state.messages).sort((a, b) => {
    const delta = (parseTime(a.timestamp) ?? 0) - (parseTime(b.timestamp) ?? 0)
    return delta !== 0 ? delta : a.message_id.localeCompare(b.message_id)
  })
  const pending = Object.values(state.pending).sort((a, b) => a.created - b.created)
  return { confirmed, pending }
}
