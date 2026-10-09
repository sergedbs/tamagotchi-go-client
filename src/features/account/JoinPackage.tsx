import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { PackagePlus } from 'lucide-react'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { useCommand } from '../../api/useCommand.ts'
import { Button } from '../../components/Button.tsx'
import { SelectField } from '../../components/Field.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { userSchema, type User } from '../auth/dto.ts'
import { canOnboard, packageLabel, usePublicPackages } from '../auth/packagesApi.ts'
import { useSessionStore } from '../auth/sessionContext.ts'
import { flattenCollection, useCollection } from '../creatures/api.ts'
import styles from './AccountPage.module.css'

/** Bounded wait for the starter the server creates after a join. */
const STARTER_WINDOW_MS = 60_000
const STARTER_POLL_MS = 2_000

/** Joining another package; its starter is created by the server afterwards. */
export function JoinPackage({ user }: { user: User }) {
  const packages = usePublicPackages()
  const store = useSessionStore()
  const queryClient = useQueryClient()
  const [packageId, setPackageId] = useState('')
  const [joined, setJoined] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)
  // Read only after a join, to notice the new starter.
  const collection = useCollection(user.user_id, { enabled: joined !== null })
  const { primary, secondary } = flattenCollection(collection.data?.pages)
  const starter = joined ? [primary, ...secondary].find((creature) => creature?.origin_package_id === joined) : undefined
  const join = useCommand<User>({
    onSuccess: (response, sent) => {
      store.updateUser(response.data)
      setPackageId('')
      setJoined((sent.body as { package_id: string }).package_id)
      setWaiting(true)
      void queryClient.invalidateQueries({ queryKey: ['user', user.user_id, 'collection'] })
    },
  })

  // Poll the collection only until the new package's starter shows up or the window closes.
  const { refetch } = collection
  const polling = waiting && !starter
  useEffect(() => {
    if (!polling) return
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refetch()
    }, STARTER_POLL_MS)
    const stop = window.setTimeout(() => setWaiting(false), STARTER_WINDOW_MS)
    return () => {
      window.clearInterval(poll)
      window.clearTimeout(stop)
    }
  }, [polling, refetch])
  const available = (packages.data?.items ?? []).filter((pkg) => canOnboard(pkg) && !user.package_ids.includes(pkg.package_id))

  if (packages.isPending) return <p className={styles.muted}>Loading packages…</p>
  if (packages.isError) return <FormAlert title="Packages could not be loaded.">{describeApiError(packages.error)}</FormAlert>
  // The notice outlives the form: joining the last open package empties the list.
  const joinedNotice = join.data ? (
    <FormAlert title="Package joined." tone="info">
      {starter ? (
        <>
          Its starter <Link to={`/creatures/${starter.id}`}>{starter.name}</Link> is now in your collection.
        </>
      ) : polling ? (
        'Its starter creature is being created by the server…'
      ) : (
        'Its starter has not arrived yet. It appears in Creatures once the server creates it.'
      )}
    </FormAlert>
  ) : null
  if (available.length === 0) {
    return (
      <div className={styles.join}>
        <p className={styles.muted}>You have joined every package that is ready for players.</p>
        {joinedNotice}
      </div>
    )
  }

  return (
    <div className={styles.join}>
      <SelectField label="Join another package" value={packageId} onChange={(event) => {
        setPackageId(event.target.value)
        if (join.command && !join.pending) join.reset()
      }}>
        <option value="">Choose a package</option>
        {available.map((pkg) => (
          <option key={pkg.package_id} value={pkg.package_id}>
            {packageLabel(pkg)}
          </option>
        ))}
      </SelectField>
      <Button
        variant="secondary"
        icon={<PackagePlus size={18} aria-hidden="true" />}
        disabled={!packageId}
        busy={join.pending}
        onClick={() =>
          join.start({
            method: 'POST',
            path: '/users/v1/users/me/packages',
            body: { package_id: packageId },
            idempotent: true,
            parse: (value) => userSchema.parse(value),
            actor: user.user_id,
          })
        }
      >
        Join package
      </Button>
      {joinedNotice}
      {join.error && (
        <FormAlert title={join.uncertain ? 'We could not confirm you joined.' : 'Package not joined.'} correlationId={isApiError(join.error) ? join.error.correlationId : null}>
          <p>{describeApiError(join.error)}</p>
          {join.uncertain && (
            <Button variant="quiet" onClick={join.retry}>
              Retry same request
            </Button>
          )}
        </FormAlert>
      )}
    </div>
  )
}
