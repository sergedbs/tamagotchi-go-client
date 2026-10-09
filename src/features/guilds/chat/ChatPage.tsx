import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, RotateCcw, SendHorizontal, Wifi, WifiOff } from 'lucide-react'
import { describeApiError } from '../../../api/errors.ts'
import { isUuid } from '../../../api/uuid.ts'
import { NotFound } from '../../../app/NotFound.tsx'
import { Button } from '../../../components/Button.tsx'
import { FormAlert } from '../../../components/FormAlert.tsx'
import { formatAbsolute } from '../../../lib/time.ts'
import { useAuthenticated } from '../../auth/sessionContext.ts'
import { PersonName } from '../../social/PersonRow.tsx'
import { useGuild } from '../api.ts'
import { timeline, type PendingMessage } from './chatState.ts'
import type { ChatMessage } from './protocol.ts'
import { useGuildChat, type ChatStatus } from './useGuildChat.ts'
import styles from './Chat.module.css'

const STATUS_TEXT: Record<ChatStatus, string> = {
  connecting: 'Connecting…',
  ready: 'Live',
  reconnecting: 'Reconnecting…',
  offline: 'Offline',
  failed: 'Not connected',
  'not-member': 'Not a member',
}

const MAX_LENGTH = 2000
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

export default function ChatPage() {
  const { id } = useParams()
  if (!isUuid(id)) return <NotFound />
  return <GuildChat key={id} guildId={id.toLowerCase()} />
}

function GuildChat({ guildId }: { guildId: string }) {
  const { user } = useAuthenticated()
  const guild = useGuild(user.user_id, guildId)
  const chat = useGuildChat(user.user_id, guildId)
  const [draft, setDraft] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const { confirmed, pending } = timeline(chat.state)
  const count = confirmed.length + pending.length

  useLayoutEffect(() => {
    const element = scroller.current
    if (element && pinned.current) element.scrollTop = element.scrollHeight
  }, [count])
  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const onScroll = () => {
      pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48
    }
    element.addEventListener('scroll', onScroll)
    return () => element.removeEventListener('scroll', onScroll)
  }, [])

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const content = draft.trim()
    if (!content || content.length > MAX_LENGTH) return
    pinned.current = true
    if (chat.send(content)) setDraft('')
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  if (chat.status === 'not-member') {
    return (
      <main className={styles.page}>
        <FormAlert title="You are not a member of this guild.">
          Chat is for members only. <Link to={`/guilds/${guildId}`}>Open the guild</Link>
        </FormAlert>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to={`/guilds/${guildId}`} className={styles.back} aria-label="Back to guild">
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <h1 className={styles.title}>{guild.data?.name ?? 'Guild chat'}</h1>
        <span className={styles.status} data-status={chat.status} role="status">
          {chat.status === 'ready' ? <Wifi size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}
          {STATUS_TEXT[chat.status]}
          {chat.status === 'reconnecting' && chat.attempt > 0 && ` (${chat.attempt}/5)`}
        </span>
      </header>

      {(chat.status === 'offline' || chat.status === 'failed') && (
        <FormAlert title={chat.status === 'offline' ? 'Chat is offline.' : 'Chat could not connect.'}>
          <p>{chat.problem ?? 'The connection is closed.'} Your draft is kept.</p>
          <Button variant="secondary" icon={<RotateCcw size={16} aria-hidden="true" />} onClick={chat.reconnect}>
            Reconnect
          </Button>
        </FormAlert>
      )}

      <div ref={scroller} className={styles.messages} aria-label="Messages" role="log" aria-live="polite">
        {chat.history.hasNextPage && (
          <Button variant="quiet" busy={chat.history.isFetchingNextPage} onClick={() => void chat.history.fetchNextPage()} className={styles.older}>
            Load older messages
          </Button>
        )}
        {chat.history.isError && <FormAlert title="History could not be loaded.">{describeApiError(chat.history.error)}</FormAlert>}
        {chat.history.isSuccess && count === 0 && <p className={styles.empty}>No messages yet. Say hello to your guild.</p>}
        <ol className={styles.list}>
          {confirmed.map((message) => (
            <Bubble key={message.message_id} message={message} own={message.author_id === user.user_id} />
          ))}
          {pending.map((item) => (
            <PendingBubble key={item.client_message_id} item={item} canRetry={chat.status === 'ready'} onRetry={() => chat.send(item.content, item.client_message_id)} />
          ))}
        </ol>
      </div>

      <form className={styles.composer} onSubmit={submit}>
        <label htmlFor="chat-draft" className="visually-hidden">
          Message
        </label>
        <textarea
          id="chat-draft"
          className={styles.draft}
          rows={1}
          value={draft}
          maxLength={MAX_LENGTH}
          placeholder={chat.status === 'ready' ? 'Message your guild' : 'Waiting for the connection…'}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button type="submit" variant="primary" icon={<SendHorizontal size={18} aria-hidden="true" />} disabled={chat.status !== 'ready' || !draft.trim()} aria-label="Send message" />
      </form>
    </main>
  )
}

function Bubble({ message, own }: { message: ChatMessage; own: boolean }) {
  return (
    <li className={own ? styles.own : styles.other}>
      <span className={styles.meta}>
        {own ? 'You' : <PersonName userId={message.author_id} />} ·{' '}
        <time dateTime={message.timestamp} title={formatAbsolute(message.timestamp)}>
          {timeFormat.format(new Date(message.timestamp))}
        </time>
      </span>
      <p className={styles.bubble}>{message.content}</p>
    </li>
  )
}

function PendingBubble({ item, canRetry, onRetry }: { item: PendingMessage; canRetry: boolean; onRetry: () => void }) {
  return (
    <li className={styles.own} data-pending={item.status}>
      <span className={styles.meta}>
        You · {item.status === 'sending' ? 'Sending…' : item.status === 'unconfirmed' ? 'Not confirmed' : `Not sent: ${item.error ?? 'refused'}`}
      </span>
      <p className={styles.bubble}>{item.content}</p>
      {item.status !== 'sending' && (
        <Button variant="quiet" disabled={!canRetry} onClick={onRetry} className={styles.retry}>
          Retry
        </Button>
      )}
    </li>
  )
}
