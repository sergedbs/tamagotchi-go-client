import { useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { UserMinus } from 'lucide-react'
import { describeApiError, isApiError } from '../../../api/errors.ts'
import { apiPath } from '../../../api/http.ts'
import { useCommand } from '../../../api/useCommand.ts'
import { Button } from '../../../components/Button.tsx'
import { ConfirmDialog } from '../../../components/ConfirmDialog.tsx'
import { FormAlert } from '../../../components/FormAlert.tsx'
import { useProfile } from '../../players/api.ts'
import { creatureKeys, useHolders } from '../api.ts'
import styles from './CreatureDetail.module.css'

function HolderName({ userId, me }: { userId: string; me: string }) {
  const profile = useProfile(userId === me ? null : userId)
  if (userId === me) return <>You</>
  if (profile.data) return <Link to={`/players/${userId}`}>{profile.data.username}</Link>
  return <span className={styles.muted}>{profile.isError ? 'Unknown player' : 'Loading…'}</span>
}

/** Shared holders as reported by the server; ownership is never shown as transferred. */
export function HoldersList({ userId, creatureId, name }: { userId: string; creatureId: string; name: string }) {
  const holders = useHolders(userId, creatureId)
  const queryClient = useQueryClient()
  const [removing, setRemoving] = useState<string | null>(null)
  const command = useCommand<void>({
    onSuccess: () => {
      setRemoving(null)
      void queryClient.invalidateQueries({ queryKey: creatureKeys.holders(userId, creatureId) })
      void queryClient.invalidateQueries({ queryKey: creatureKeys.creature(userId, creatureId) })
    },
    onError: (error) => {
      if (isApiError(error) && error.status === 412) void holders.refetch()
    },
  })

  if (holders.isPending) return <p className={styles.muted}>Loading holders…</p>
  if (holders.isError) return <FormAlert title="Holders could not be loaded.">{describeApiError(holders.error)}</FormAlert>
  const { value, etag } = holders.data
  const isOriginOwner = value.origin_owner_id === userId

  return (
    <section className={styles.section} aria-labelledby="holders-heading">
      <h2 id="holders-heading">
        Holders{' '}
        <span className={styles.count}>
          {value.holder_user_ids.length} of {value.holder_cap}
        </span>
      </h2>
      <ul className={styles.holders}>
        {value.holder_user_ids.map((holder) => (
          <li key={holder}>
            <span className={styles.holderName}>
              <HolderName userId={holder} me={userId} />
              {holder === value.origin_owner_id && <span className={styles.tag}>Origin owner</span>}
            </span>
            {isOriginOwner && holder !== userId && (
              <Button variant="quiet" icon={<UserMinus size={16} aria-hidden="true" />} disabled={!etag} onClick={() => setRemoving(holder)}>
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={removing !== null}
        title="Remove this holder?"
        tone="danger"
        confirmLabel="Remove holder"
        busy={command.pending}
        onClose={() => {
          setRemoving(null)
          command.reset()
        }}
        onConfirm={() =>
          removing &&
          etag &&
          command.start({
            method: 'DELETE',
            path: apiPath`/tamagotchi/v1/tamagotchis/${creatureId}/holders/${removing}`,
            idempotent: false,
            ifMatch: etag,
            actor: userId,
          })
        }
        feedback={
          command.error ? (
            <FormAlert title="Holder not removed." correlationId={isApiError(command.error) ? command.error.correlationId : null}>
              {isApiError(command.error) && command.error.status === 412
                ? 'The holder list changed. It has been reloaded; review and try again.'
                : describeApiError(command.error)}
            </FormAlert>
          ) : null
        }
      >
        <p>They lose access to {name}. Your own ownership is unchanged.</p>
      </ConfirmDialog>
    </section>
  )
}
