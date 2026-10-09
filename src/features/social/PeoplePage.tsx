import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Search, X } from 'lucide-react'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { apiPath } from '../../api/http.ts'
import { useCommand } from '../../api/useCommand.ts'
import { isUuid } from '../../api/uuid.ts'
import { Button } from '../../components/Button.tsx'
import { CopyValue } from '../../components/CopyValue.tsx'
import { TextField } from '../../components/Field.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { LoadProblem } from '../../components/LoadProblem.tsx'
import { formatRelative } from '../../lib/time.ts'
import { useNow } from '../../lib/useNow.ts'
import { useAuthenticated } from '../auth/sessionContext.ts'
import { friendRequestSchema, reconcileSocial, useFriendRequests, useRelationships, type FriendRequest } from './api.ts'
import { PersonRow } from './PersonRow.tsx'
import { SocialNav } from './SocialNav.tsx'
import styles from './Social.module.css'

export default function PeoplePage() {
  const { user } = useAuthenticated()
  const relationships = useRelationships(user.user_id)
  const requests = useFriendRequests(user.user_id)
  const now = useNow()
  const pending = requests.data?.items.filter((request) => request.status === 'PENDING') ?? []
  const incoming = pending.filter((request) => request.to_user_id === user.user_id)
  const outgoing = pending.filter((request) => request.from_user_id === user.user_id)
  const friends = relationships.data?.items.filter((item) => item.relationship === 'friend') ?? []
  const enemies = relationships.data?.items.filter((item) => item.relationship === 'enemy') ?? []

  return (
    <main className={styles.page}>
      <SocialNav />
      <header className={styles.header}>
        <h1>People</h1>
        <p className={styles.lead}>Players you know. Meet new ones nearby in Explore or through guild rosters.</p>
      </header>

      <section className={styles.section} aria-labelledby="requests-heading">
        <h2 id="requests-heading">Friend requests</h2>
        {requests.isPending ? (
          <p className={styles.muted}>Loading requests…</p>
        ) : requests.isError ? (
          <LoadProblem title="Requests could not be loaded" message={describeApiError(requests.error)} correlationId={isApiError(requests.error) ? requests.error.correlationId : null} onRetry={() => void requests.refetch()} />
        ) : incoming.length + outgoing.length === 0 ? (
          <p className={styles.muted}>No pending requests.</p>
        ) : (
          <ul className={styles.people}>
            {incoming.map((request) => (
              <IncomingRequest key={request.request_id} request={request} me={user.user_id} now={now} />
            ))}
            {outgoing.map((request) => (
              <PersonRow key={request.request_id} userId={request.to_user_id} meta={`Request sent · expires ${formatRelative(request.expires_at, now)}`} />
            ))}
          </ul>
        )}
      </section>

      {relationships.isError ? (
        <LoadProblem
          title="Relationships could not be loaded"
          message={describeApiError(relationships.error)}
          correlationId={isApiError(relationships.error) ? relationships.error.correlationId : null}
          onRetry={() => void relationships.refetch()}
        />
      ) : (
        <div className={styles.columns}>
          <section className={styles.section} aria-labelledby="friends-heading">
            <h2 id="friends-heading">
              Friends <span className={styles.count}>{relationships.isPending ? '' : friends.length}</span>
            </h2>
            {relationships.isPending ? (
              <p className={styles.muted}>Loading…</p>
            ) : friends.length === 0 ? (
              <p className={styles.muted}>No friends yet. Send a request from a player&rsquo;s profile.</p>
            ) : (
              <ul className={styles.people}>
                {friends.map((item) => (
                  <PersonRow key={item.user_id} userId={item.user_id} relationship="friend" />
                ))}
              </ul>
            )}
          </section>
          <section className={styles.section} aria-labelledby="enemies-heading">
            <h2 id="enemies-heading">
              Enemies <span className={styles.count}>{relationships.isPending ? '' : enemies.length}</span>
            </h2>
            {relationships.isPending ? (
              <p className={styles.muted}>Loading…</p>
            ) : enemies.length === 0 ? (
              <p className={styles.muted}>No enemies marked.</p>
            ) : (
              <ul className={styles.people}>
                {enemies.map((item) => (
                  <PersonRow key={item.user_id} userId={item.user_id} relationship="enemy" />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      {relationships.data?.truncated && <p className={styles.muted}>Showing the first 250 relationships.</p>}

      <PlayerLookup userId={user.user_id} />
    </main>
  )
}

function IncomingRequest({ request, me, now }: { request: FriendRequest; me: string; now: number }) {
  const queryClient = useQueryClient()
  const command = useCommand<FriendRequest>({ onSuccess: () => reconcileSocial(queryClient, me) })
  const answer = (verb: 'accept' | 'reject') =>
    command.start({
      method: 'POST',
      path: verb === 'accept' ? apiPath`/users/v1/friend-requests/${request.request_id}/accept` : apiPath`/users/v1/friend-requests/${request.request_id}/reject`,
      idempotent: true,
      parse: (value) => friendRequestSchema.parse(value),
      actor: me,
    })
  return (
    <PersonRow userId={request.from_user_id} meta={`Wants to be friends · expires ${formatRelative(request.expires_at, now)}`}>
      <Button variant="primary" icon={<Check size={18} aria-hidden="true" />} busy={command.pending} onClick={() => answer('accept')}>
        Accept
      </Button>
      <Button variant="secondary" icon={<X size={18} aria-hidden="true" />} disabled={command.pending} onClick={() => answer('reject')}>
        Reject
      </Button>
      {command.error && (
        <FormAlert title="Not answered." correlationId={isApiError(command.error) ? command.error.correlationId : null}>
          {describeApiError(command.error)}{' '}
          {command.uncertain && (
            <Button variant="quiet" onClick={command.retry}>
              Retry same request
            </Button>
          )}
        </FormAlert>
      )}
    </PersonRow>
  )
}

/** There is no username search API; a player ID is the secondary way in. */
function PlayerLookup({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const id = value.trim().toLowerCase()
    if (!isUuid(id)) return setError('Enter a full player ID (a UUID such as 01a1…-…).')
    navigate(`/players/${id}`)
  }
  return (
    <section className={styles.section} aria-labelledby="lookup-heading">
      <h2 id="lookup-heading">Find a player by ID</h2>
      <p className={styles.muted}>
        <CopyValue value={userId} label="Your player ID" size="body" />
      </p>
      <form className={styles.lookup} onSubmit={submit}>
        <TextField
          label="Player ID"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
          error={error}
          hint="Usernames cannot be searched. Ask the player for the ID shown in their Account."
          spellCheck={false}
          autoComplete="off"
        />
        <Button type="submit" variant="secondary" icon={<Search size={18} aria-hidden="true" />}>
          Open profile
        </Button>
      </form>
    </section>
  )
}
