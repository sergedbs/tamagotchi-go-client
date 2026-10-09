import { useEffect, useState, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BellOff, BellRing } from 'lucide-react'
import { useApi } from '../../api/apiContext.ts'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { useCommand } from '../../api/useCommand.ts'
import { useConfig } from '../../app/configContext.ts'
import { Button } from '../../components/Button.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { deviceSchema, notificationKeys, type Device } from '../notifications/api.ts'
import { readOwner, subscribeOwner, writeOwner } from './owner.ts'
import { PushSetupError, pushSupport, releasePush, requestPushToken, type PushSupport } from './push.ts'
import { turnOffPush } from './turnOff.ts'
import styles from '../account/AccountPage.module.css'

const SETUP_TEXT: Record<PushSetupError['reason'], string> = {
  denied: 'Notifications are blocked for this site. Allow them in your browser’s site settings, then try again.',
  dismissed: 'Permission was not granted, so push stays off.',
  failed: 'This browser could not subscribe to push right now.',
}

const deviceLocale = () => (navigator.language || 'en').slice(0, 35)

/**
 * Explicit, per-browser opt-in. Permission is requested only from the Turn on
 * click; the device token goes straight into the registration and is never shown.
 */
export function PushControls({ userId, packageId }: { userId: string; packageId: string }) {
  const config = useConfig().push
  const api = useApi()
  const queryClient = useQueryClient()
  const owner = useSyncExternalStore(subscribeOwner, readOwner)
  const [support, setSupport] = useState<PushSupport | 'checking'>('checking')
  const [busy, setBusy] = useState(false)
  const [setupError, setSetupError] = useState<PushSetupError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const refreshDevices = () => void queryClient.invalidateQueries({ queryKey: notificationKeys.devices(userId) })
  const register = useCommand<Device>({
    onSuccess: (response) => {
      writeOwner({ user_id: userId, device_id: response.data.id })
      setNotice('Push is on for this browser.')
      refreshDevices()
    },
  })

  useEffect(() => {
    let active = true
    pushSupport(config).then(
      (value) => active && setSupport(value),
      () => active && setSupport('unsupported'),
    )
    return () => {
      active = false
    }
  }, [config])

  const isOn = owner?.user_id === userId && owner.device_id !== null

  const turnOn = async () => {
    if (!config) return
    setSetupError(null)
    setNotice(null)
    register.reset()
    setBusy(true)
    // Recorded before a token exists, so an interrupted setup is still released at sign-out.
    writeOwner({ user_id: userId, device_id: null })
    try {
      const token = await requestPushToken(config)
      setSupport('granted')
      register.start({
        method: 'POST',
        path: '/notification/v1/devices',
        body: { fcm_token: token, platform: 'WEB', package_id: packageId, locale: deviceLocale() },
        idempotent: true,
        actor: userId,
        parse: (value) => deviceSchema.parse(value),
      })
    } catch (error) {
      const failure = error instanceof PushSetupError ? error : new PushSetupError('failed')
      setSetupError(failure)
      if (failure.reason === 'denied') setSupport('denied')
      await releasePush(config).catch(() => undefined)
      writeOwner(null)
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async () => {
    if (!owner) return
    setSetupError(null)
    setNotice(null)
    register.reset()
    setBusy(true)
    const removed = await turnOffPush(api, config, owner)
    setBusy(false)
    refreshDevices()
    setNotice(removed ? 'Push is off for this browser.' : 'This browser no longer receives push, but its entry could not be removed. You can remove it from the list below.')
  }

  if (support === 'checking') return <p className={styles.muted}>Checking push support…</p>
  if (support === 'unconfigured') {
    return <p className={styles.muted}>Push is not configured for this web client, so it never asks for notification permission. Your inbox always works.</p>
  }

  return (
    <div className={styles.push}>
      {isOn && support === 'denied' ? (
        <p className={styles.muted}>Push is registered here, but notifications are now blocked for this site. Allow them again in your browser’s site settings, or turn push off.</p>
      ) : isOn ? (
        <p>
          <strong>Push is on for this browser.</strong> New notifications appear as system notifications, even when this tab is closed. Signing out turns it off.
        </p>
      ) : support === 'unsupported' ? (
        <p className={styles.muted}>This browser cannot receive push notifications here. Your inbox always works.</p>
      ) : support === 'denied' ? (
        <p className={styles.muted}>Notifications are blocked for this site. To use push, allow them in your browser’s site settings. Your inbox always works.</p>
      ) : (
        <p className={styles.muted}>Get a system notification for new inbox items, even when this tab is closed. Your browser asks for permission first.</p>
      )}
      {isOn ? (
        <Button variant="secondary" icon={<BellOff size={18} aria-hidden="true" />} busy={busy} onClick={() => void turnOff()}>
          Turn off push
        </Button>
      ) : (
        support !== 'unsupported' &&
        support !== 'denied' && (
          <Button variant="primary" icon={<BellRing size={18} aria-hidden="true" />} busy={busy || register.pending} onClick={() => void turnOn()}>
            Turn on push for this browser
          </Button>
        )
      )}
      {notice && (
        <p role="status" className={styles.muted}>
          {notice}
        </p>
      )}
      {setupError && (
        <FormAlert title="Push was not turned on.">
          {SETUP_TEXT[setupError.reason]}
          {setupError.code && ` (${setupError.code})`}
        </FormAlert>
      )}
      {register.error && (
        <FormAlert title="This browser was not registered for push." correlationId={isApiError(register.error) ? register.error.correlationId : null}>
          {describeApiError(register.error)}
          {register.uncertain && (
            <Button variant="quiet" onClick={register.retry}>
              Retry same request
            </Button>
          )}
        </FormAlert>
      )}
    </div>
  )
}
