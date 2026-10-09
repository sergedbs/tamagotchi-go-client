import { useState } from 'react'
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
import styles from './AccountPage.module.css'

/** Joining another package; its starter is created by the server afterwards. */
export function JoinPackage({ user }: { user: User }) {
  const packages = usePublicPackages()
  const store = useSessionStore()
  const queryClient = useQueryClient()
  const [packageId, setPackageId] = useState('')
  const join = useCommand<User>({
    onSuccess: (response) => {
      store.updateUser(response.data)
      setPackageId('')
      void queryClient.invalidateQueries({ queryKey: ['user', user.user_id, 'collection'] })
    },
  })
  const available = (packages.data?.items ?? []).filter((pkg) => canOnboard(pkg) && !user.package_ids.includes(pkg.package_id))

  if (packages.isPending) return <p className={styles.muted}>Loading packages…</p>
  if (packages.isError) return <FormAlert title="Packages could not be loaded.">{describeApiError(packages.error)}</FormAlert>
  if (available.length === 0) return <p className={styles.muted}>You have joined every package that is ready for players.</p>

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
      {join.data && <FormAlert title="Package joined." tone="info">Its starter creature is created by the server and appears in Creatures shortly.</FormAlert>}
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
