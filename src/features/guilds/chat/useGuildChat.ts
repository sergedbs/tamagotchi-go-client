import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useApi } from '../../../api/apiContext.ts'
import { describeApiError, isApiError } from '../../../api/errors.ts'
import { apiPath } from '../../../api/http.ts'
import { newUuidV7 } from '../../../api/uuid.ts'
import { useConfig } from '../../../app/configContext.ts'
import { LIST_LIMIT } from '../../social/api.ts'
import { guildKeys } from '../api.ts'
import { chatReducer, initialChat } from './chatState.ts'
import { chatPageSchema, CLOSE_NOT_MEMBER, CLOSE_TICKET_REFUSED, parseFrame, reconnectDelay, validateSocketUrl, wsTicketSchema } from './protocol.ts'

export type ChatStatus = 'connecting' | 'ready' | 'reconnecting' | 'offline' | 'failed' | 'not-member'

const AUTH_TIMEOUT_MS = 10_000

export function useGuildChat(userId: string, guildId: string) {
  const api = useApi()
  const config = useConfig()
  const [state, dispatch] = useReducer(chatReducer, initialChat)
  const [status, setStatus] = useState<ChatStatus>('connecting')
  const [problem, setProblem] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const socket = useRef<WebSocket | null>(null)
  const timers = useRef<number[]>([])
  const attempts = useRef(0)
  const active = useRef(true)
  const reconnectRef = useRef<() => void>(() => undefined)

  const history = useInfiniteQuery({
    queryKey: guildKeys.messages(userId, guildId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) =>
      (
        await api.request({
          method: 'GET',
          path: apiPath`/guild/v1/guilds/${guildId}/messages`,
          query: { limit: LIST_LIMIT, cursor: pageParam },
          auth: 'user',
          parse: (value) => chatPageSchema.parse(value),
          signal,
        })
      ).data,
    getNextPageParam: (last) => last.next_cursor,
    staleTime: 0,
  })
  useEffect(() => {
    if (history.data) dispatch({ type: 'history', items: history.data.pages.flatMap((page) => page.items) })
  }, [history.data])
  const { refetch: refetchHistory } = history

  const clearTimers = () => {
    for (const timer of timers.current) window.clearTimeout(timer)
    timers.current = []
  }

  const connect = useCallback(async () => {
    clearTimers()
    socket.current?.close(1000)
    socket.current = null
    setStatus(attempts.current === 0 ? 'connecting' : 'reconnecting')
    setProblem(null)

    const scheduleRetry = (reason: string) => {
      if (!active.current) return
      const delay = reconnectDelay(attempts.current)
      if (delay === null) {
        setStatus('offline')
        setProblem(reason)
        return
      }
      attempts.current += 1
      setAttempt(attempts.current)
      setStatus('reconnecting')
      setProblem(reason)
      const run = () => {
        if (document.visibilityState === 'visible') reconnectRef.current()
        else document.addEventListener('visibilitychange', () => reconnectRef.current(), { once: true })
      }
      timers.current.push(window.setTimeout(run, delay))
    }

    let ticket
    try {
      // Every connection negotiates a fresh, single-use ticket.
      ticket = (
        await api.request({
          method: 'POST',
          path: '/gateway/v1/ws-negotiate',
          body: { resource: 'guild.chat', resource_id: guildId },
          auth: 'user',
          parse: (value) => wsTicketSchema.parse(value),
        })
      ).data
    } catch (error) {
      if (!active.current) return
      if (isApiError(error) && error.status === 403) {
        setStatus('not-member')
        return
      }
      if (isApiError(error) && error.status !== null && error.status < 500 && error.status !== 429) {
        setStatus('failed')
        setProblem(describeApiError(error))
        return
      }
      scheduleRetry(describeApiError(error))
      return
    }
    if (!active.current) return
    const url = validateSocketUrl(ticket.url, guildId, config.allowed_socket_origins, window.location.protocol)
    if (!url) {
      setStatus('failed')
      setProblem('The chat server address is not allowed by this client configuration.')
      return
    }

    const ws = new WebSocket(url)
    socket.current = ws
    let ready = false
    const authTimer = window.setTimeout(() => !ready && ws.close(4000, 'auth timeout'), AUTH_TIMEOUT_MS)
    timers.current.push(authTimer)
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', ticket: ticket.ticket }))
    ws.onmessage = (event) => {
      const frame = parseFrame(event.data)
      if (!frame) return
      if (frame.type === 'ready') {
        ready = true
        attempts.current = 0
        setAttempt(0)
        setStatus('ready')
        setProblem(null)
        void refetchHistory() // reconcile anything missed while away
      } else if (frame.type === 'ack') {
        dispatch({ type: 'ack', client_message_id: frame.client_message_id, message_id: frame.message_id, timestamp: frame.timestamp })
      } else if (frame.type === 'message') {
        dispatch({ type: 'message', message: frame.message })
      } else if (frame.client_message_id) {
        dispatch({ type: 'failed', client_message_id: frame.client_message_id, error: frame.detail })
      } else {
        setProblem(frame.detail)
      }
    }
    ws.onclose = (event) => {
      if (socket.current !== ws || !active.current) return
      socket.current = null
      dispatch({ type: 'disconnected' })
      if (event.code === CLOSE_NOT_MEMBER) return setStatus('not-member')
      if (event.code === CLOSE_TICKET_REFUSED) {
        setStatus('failed')
        setProblem('The chat ticket was refused. Reconnect to try with a new one.')
        return
      }
      scheduleRetry('The chat connection dropped.')
    }
  }, [api, config.allowed_socket_origins, guildId, refetchHistory])

  useEffect(() => {
    reconnectRef.current = () => void connect()
  }, [connect])

  useEffect(() => {
    active.current = true
    attempts.current = 0
    void connect()
    const offline = () => {
      socket.current?.close(1000)
      socket.current = null
      clearTimers()
      dispatch({ type: 'disconnected' })
      setStatus('offline')
      setProblem('Your device is offline.')
    }
    const online = () => {
      attempts.current = 0
      void connect()
    }
    window.addEventListener('offline', offline)
    window.addEventListener('online', online)
    return () => {
      active.current = false
      window.removeEventListener('offline', offline)
      window.removeEventListener('online', online)
      clearTimers()
      socket.current?.close(1000)
      socket.current = null
    }
  }, [connect])

  /** Sends only while ready; drafts stay with the caller and are never auto-sent. */
  const send = (content: string, existingId?: string): boolean => {
    const ws = socket.current
    if (status !== 'ready' || !ws || ws.readyState !== WebSocket.OPEN) return false
    const client_message_id = existingId ?? newUuidV7()
    dispatch({ type: 'sending', pending: { client_message_id, content, author_id: userId, status: 'sending', created: Date.now() } })
    ws.send(JSON.stringify({ type: 'send', client_message_id, content }))
    return true
  }

  return {
    state,
    status,
    problem,
    attempt,
    history,
    send,
    reconnect: () => {
      attempts.current = 0
      void connect()
    },
  }
}
