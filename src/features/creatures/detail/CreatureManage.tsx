import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Star, Trash2 } from 'lucide-react'
import { describeApiError, isApiError } from '../../../api/errors.ts'
import { apiPath } from '../../../api/http.ts'
import { useCommand } from '../../../api/useCommand.ts'
import { Button } from '../../../components/Button.tsx'
import { ConfirmDialog } from '../../../components/ConfirmDialog.tsx'
import { FormAlert } from '../../../components/FormAlert.tsx'
import { creatureKeys, usePrimarySelection, type WithEtag } from '../api.ts'
import { primarySelectionSchema, type PrimarySelection, type Tamagotchi } from '../dto.ts'
import styles from './CreatureDetail.module.css'

function failureText(error: unknown, name: string): string {
  if (isApiError(error)) {
    if (error.status === 412) return 'This changed since it was loaded. The latest version has been reloaded; review and confirm again.'
    if (error.code === 'creature_engaged') return `${name} is busy in a battle or raid right now.`
  }
  return describeApiError(error)
}

export function MakePrimary({ userId, creature }: { userId: string; creature: Tamagotchi }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const selection = usePrimarySelection(userId, open)
  const command = useCommand<PrimarySelection>({
    onSuccess: (response) => {
      queryClient.setQueryData<WithEtag<PrimarySelection>>(creatureKeys.primary(userId), { value: response.data, etag: response.etag })
      void queryClient.invalidateQueries({ queryKey: creatureKeys.collection(userId) })
      void queryClient.invalidateQueries({ queryKey: ['user', userId, 'tamagotchi'] })
      setOpen(false)
    },
    onError: (error) => {
      if (isApiError(error) && error.status === 412) void selection.refetch()
    },
  })
  const etag = selection.data?.etag ?? null

  return (
    <>
      <Button variant="secondary" icon={<Star size={18} aria-hidden="true" />} onClick={() => setOpen(true)}>
        Make primary
      </Button>
      <ConfirmDialog
        open={open}
        title={`Make ${creature.name} your primary?`}
        confirmLabel="Make primary"
        busy={command.pending}
        confirmDisabled={selection.isFetching || !etag}
        onClose={() => {
          setOpen(false)
          command.reset()
        }}
        onConfirm={() =>
          etag &&
          command.start({
            method: 'PUT',
            path: apiPath`/tamagotchi/v1/users/${userId}/collection/primary`,
            body: { tamagotchi_id: creature.id },
            idempotent: false,
            ifMatch: etag,
            parse: (value) => primarySelectionSchema.parse(value),
            actor: userId,
          })
        }
        feedback={
          command.error ? (
            <FormAlert title="Primary not changed." correlationId={isApiError(command.error) ? command.error.correlationId : null}>
              {failureText(command.error, creature.name)}
            </FormAlert>
          ) : selection.isError ? (
            <FormAlert title="Your current primary could not be loaded.">{describeApiError(selection.error)}</FormAlert>
          ) : selection.isSuccess && !etag ? (
            <FormAlert title="The server did not provide a version tag, so the primary cannot be changed safely." />
          ) : null
        }
      >
        <p>Your primary is shown on your home screen and is the companion you bring into raids.</p>
      </ConfirmDialog>
    </>
  )
}

export function ReleaseCreature({
  userId,
  creature,
  etag,
  refreshing,
}: {
  userId: string
  creature: Tamagotchi
  etag: string | null
  refreshing: boolean
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const finalOwnership = creature.origin_owner_id === userId && creature.holder_user_ids.length <= 1
  const command = useCommand<void>({
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: creatureKeys.creature(userId, creature.id) })
      void queryClient.invalidateQueries({ queryKey: creatureKeys.collection(userId) })
      navigate('/creatures', { replace: true })
    },
    onError: (error) => {
      if (isApiError(error) && error.status === 412) {
        void queryClient.invalidateQueries({ queryKey: creatureKeys.creature(userId, creature.id) })
      }
    },
  })

  return (
    <div className={styles.release}>
      <Button variant="danger" icon={<Trash2 size={18} aria-hidden="true" />} disabled={finalOwnership || !etag} onClick={() => setOpen(true)}>
        Release
      </Button>
      {finalOwnership ? (
        <p className={styles.hint}>You are the origin owner and the only holder, so {creature.name} cannot be released.</p>
      ) : !etag ? (
        <p className={styles.hint}>{refreshing ? 'Loading the latest version…' : 'Reload this creature before releasing it.'}</p>
      ) : null}
      <ConfirmDialog
        open={open}
        title={`Release ${creature.name}?`}
        tone="danger"
        confirmLabel="Release"
        busy={command.pending}
        onClose={() => {
          setOpen(false)
          command.reset()
        }}
        onConfirm={() =>
          etag &&
          command.start({
            method: 'DELETE',
            path: apiPath`/tamagotchi/v1/users/${userId}/collection/${creature.id}`,
            idempotent: false,
            ifMatch: etag,
            actor: userId,
          })
        }
        feedback={
          command.error ? (
            <FormAlert title="Not released." correlationId={isApiError(command.error) ? command.error.correlationId : null}>
              {failureText(command.error, creature.name)}
            </FormAlert>
          ) : null
        }
      >
        <p>{creature.name} leaves your collection. Other holders keep their access. This cannot be undone from the client.</p>
        {creature.role === 'PRIMARY' && <p>It is your primary companion, so you will need to choose another.</p>}
      </ConfirmDialog>
    </div>
  )
}
