import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, HeartHandshake, Swords, UserMinus, X } from 'lucide-react'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { apiPath } from '../../api/http.ts'
import { useCommand } from '../../api/useCommand.ts'
import { Button } from '../../components/Button.tsx'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { formatRelative } from '../../lib/time.ts'
import { useNow } from '../../lib/useNow.ts'
import { friendRequestSchema, pendingRequestWith, reconcileSocial, relationshipWith, useFriendRequests, useRelationships } from './api.ts'
import styles from './Social.module.css'

type Confirming = 'unfriend' | 'enemy' | null

/** Friend/enemy commands for one other player, reconciled from the server afterwards. */
export function RelationshipActions({ me, otherId, name }: { me: string; otherId: string; name: string }) {
  const queryClient = useQueryClient()
  const now = useNow()
  const relationships = useRelationships(me)
  const requests = useFriendRequests(me)
  const [confirming, setConfirming] = useState<Confirming>(null)
  const command = useCommand<unknown>({
    onSuccess: () => {
      setConfirming(null)
      reconcileSocial(queryClient, me)
    },
  })

  if (relationships.isPending || requests.isPending) return <p className={styles.muted}>Checking your relationship…</p>
  if (relationships.isError) return <FormAlert title="Relationships could not be loaded.">{describeApiError(relationships.error)}</FormAlert>

  const relationship = relationshipWith(relationships.data.items, otherId)
  const { incoming, outgoing } = pendingRequestWith(requests.data?.items, me, otherId)
  const run = (spec: { method: 'POST' | 'PUT' | 'DELETE'; path: string; body?: unknown; idempotent: boolean }) =>
    command.start({ ...spec, actor: me, parse: spec.method === 'POST' && spec.body ? (value) => friendRequestSchema.parse(value) : undefined })

  return (
    <div className={styles.actions}>
      <div className={styles.actionRow}>
        {relationship === 'stranger' && !incoming && !outgoing && (
          <Button
            variant="primary"
            icon={<HeartHandshake size={18} aria-hidden="true" />}
            busy={command.pending}
            onClick={() => run({ method: 'POST', path: '/users/v1/friend-requests', body: { to_user_id: otherId }, idempotent: true })}
          >
            Send friend request
          </Button>
        )}
        {incoming && (
          <>
            <Button
              variant="primary"
              icon={<Check size={18} aria-hidden="true" />}
              busy={command.pending}
              onClick={() => run({ method: 'POST', path: apiPath`/users/v1/friend-requests/${incoming.request_id}/accept`, idempotent: true })}
            >
              Accept request
            </Button>
            <Button
              variant="secondary"
              icon={<X size={18} aria-hidden="true" />}
              disabled={command.pending}
              onClick={() => run({ method: 'POST', path: apiPath`/users/v1/friend-requests/${incoming.request_id}/reject`, idempotent: true })}
            >
              Reject
            </Button>
          </>
        )}
        {outgoing && <p className={styles.muted}>Friend request sent · expires {formatRelative(outgoing.expires_at, now)}</p>}
        {relationship === 'friend' && (
          <Button variant="secondary" icon={<UserMinus size={18} aria-hidden="true" />} onClick={() => setConfirming('unfriend')}>
            Unfriend
          </Button>
        )}
        {relationship !== 'enemy' ? (
          <Button variant="quiet" icon={<Swords size={18} aria-hidden="true" />} onClick={() => setConfirming('enemy')}>
            Mark as enemy
          </Button>
        ) : (
          <Button
            variant="secondary"
            busy={command.pending}
            onClick={() => run({ method: 'DELETE', path: apiPath`/users/v1/users/${me}/enemies/${otherId}`, idempotent: false })}
          >
            Remove enemy mark
          </Button>
        )}
      </div>
      {command.error && !confirming && (
        <FormAlert title={command.uncertain ? 'The change could not be confirmed.' : 'Not changed.'} correlationId={isApiError(command.error) ? command.error.correlationId : null}>
          <p>{describeApiError(command.error)}</p>
          {command.uncertain && (
            <Button variant="quiet" onClick={command.retry}>
              Retry same request
            </Button>
          )}
        </FormAlert>
      )}
      <ConfirmDialog
        open={confirming !== null}
        title={confirming === 'unfriend' ? `Unfriend ${name}?` : `Mark ${name} as an enemy?`}
        tone="danger"
        confirmLabel={confirming === 'unfriend' ? 'Unfriend' : 'Mark as enemy'}
        busy={command.pending}
        onClose={() => {
          setConfirming(null)
          command.reset()
        }}
        onConfirm={() =>
          confirming === 'unfriend'
            ? run({ method: 'DELETE', path: apiPath`/users/v1/users/${me}/friends/${otherId}`, idempotent: false })
            : run({ method: 'PUT', path: apiPath`/users/v1/users/${me}/enemies/${otherId}`, idempotent: false })
        }
        feedback={command.error ? <FormAlert title="Not changed." correlationId={isApiError(command.error) ? command.error.correlationId : null}>{describeApiError(command.error)}</FormAlert> : null}
      >
        <p>
          {confirming === 'unfriend'
            ? `You and ${name} stop being friends. You can send a new request later.`
            : `${name} is marked as an enemy in your relationships.`}
        </p>
      </ConfirmDialog>
    </div>
  )
}
