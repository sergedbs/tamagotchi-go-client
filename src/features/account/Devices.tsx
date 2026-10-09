import { useState, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Smartphone, Trash2 } from 'lucide-react'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { apiPath } from '../../api/http.ts'
import { useCommand } from '../../api/useCommand.ts'
import { Button } from '../../components/Button.tsx'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { useConfig } from '../../app/configContext.ts'
import { formatAbsolute } from '../../lib/time.ts'
import { notificationKeys, useDevices, type Device } from '../notifications/api.ts'
import { readOwner, subscribeOwner, writeOwner } from '../push/owner.ts'
import { PushControls } from '../push/PushControls.tsx'
import { releasePush } from '../push/push.ts'
import styles from './AccountPage.module.css'

const PLATFORM: Record<Device['platform'], string> = { ANDROID: 'Android', IOS: 'iOS', WEB: 'Web browser' }

/** This browser's push opt-in, and every registered device of the account. */
export function Devices({ userId, packageId, nameOf }: { userId: string; packageId: string; nameOf: (packageId: string) => string }) {
  const devices = useDevices(userId)
  const queryClient = useQueryClient()
  const push = useConfig().push
  const owner = useSyncExternalStore(subscribeOwner, readOwner)
  const thisBrowser = owner?.user_id === userId ? owner.device_id : null
  const [removing, setRemoving] = useState<Device | null>(null)
  const remove = useCommand<void>({
    onSuccess: () => {
      // Removing this browser's entry also ends its subscription.
      if (removing && removing.id === thisBrowser) void releasePush(push).finally(() => writeOwner(null))
      setRemoving(null)
      void queryClient.invalidateQueries({ queryKey: notificationKeys.devices(userId) })
    },
  })
  const items = devices.data?.items ?? []

  return (
    <section aria-labelledby="devices-heading" className={styles.section}>
      <h2 id="devices-heading">Push devices</h2>
      <PushControls userId={userId} packageId={packageId} />
      {devices.isPending ? (
        <p className={styles.muted}>Loading devices…</p>
      ) : devices.isError ? (
        <FormAlert title="Devices could not be loaded." correlationId={isApiError(devices.error) ? devices.error.correlationId : null}>
          {describeApiError(devices.error)}
        </FormAlert>
      ) : items.length === 0 ? (
        <p className={styles.muted}>No devices are registered.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((device) => (
            <li key={device.id} className={styles.device}>
              <Smartphone size={20} aria-hidden="true" />
              <span className={styles.deviceText}>
                <strong>
                  {PLATFORM[device.platform]}
                  {device.id === thisBrowser && ' · This browser'}
                </strong>
                <span className={styles.muted}>
                  {nameOf(device.package_id)} · {device.locale} · registered {formatAbsolute(device.registered_at)}
                </span>
              </span>
              <Button variant="quiet" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => setRemoving(device)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {devices.data?.truncated && <p className={styles.muted}>Only the first devices are shown.</p>}
      <ConfirmDialog
        open={removing !== null}
        title="Remove this device?"
        tone="danger"
        confirmLabel="Remove device"
        busy={remove.pending}
        onClose={() => {
          setRemoving(null)
          remove.reset()
        }}
        onConfirm={() => removing && remove.start({ method: 'DELETE', path: apiPath`/notification/v1/devices/${removing.id}`, idempotent: false, actor: userId })}
        feedback={remove.error ? <FormAlert title="Device not removed." correlationId={isApiError(remove.error) ? remove.error.correlationId : null}>{describeApiError(remove.error)}</FormAlert> : null}
      >
        <p>It stops receiving push notifications for your account.</p>
      </ConfirmDialog>
    </section>
  )
}
