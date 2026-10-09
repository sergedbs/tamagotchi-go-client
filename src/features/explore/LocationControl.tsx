import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Crosshair, EyeOff, LocateFixed, RefreshCw } from 'lucide-react'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { apiPath } from '../../api/http.ts'
import { useCommand } from '../../api/useCommand.ts'
import { useConfig } from '../../app/configContext.ts'
import { Button } from '../../components/Button.tsx'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { formatAbsolute, formatRelative } from '../../lib/time.ts'
import { exploreKeys } from './api.ts'
import { locationReceiptSchema, type LocationReceipt, type OwnLocation } from './dto.ts'
import { formatDistance } from './geo.ts'
import { GEO_FAILURE_TEXT, useGeolocation, type Fix } from './useGeolocation.ts'
import styles from './Explore.module.css'

// Receipt reasons as observed on the live Map service: STALE means the reading's
// timestamp is older than the map accepts (about one minute), not that a newer
// location exists; OUT_OF_ORDER means a newer reading is already stored.
const NOT_UPDATED: Record<Exclude<LocationReceipt['reason'], 'ACCEPTED'>, string> = {
  DUPLICATE: 'This exact observation was already recorded; nothing changed.',
  STALE: 'That reading was too old for the map, which only accepts locations from the last minute. Locate again to share a fresh one.',
  OUT_OF_ORDER: 'A newer location of yours is already on the map, so this older reading was not used.',
}

/** A preview older than this is located again rather than sent (the map accepts about 60 s). */
const PREVIEW_MAX_AGE_MS = 30_000

interface LocationControlProps {
  userId: string
  location: OwnLocation | null
  expired: boolean
  now: number
  preview: Fix | null
  onPreview: (fix: Fix | null) => void
  onRefresh: () => void
  refreshing: boolean
  canRefresh: boolean
}

export function LocationControl(props: LocationControlProps) {
  const { userId, location, expired, now, preview, onPreview } = props
  const config = useConfig()
  const queryClient = useQueryClient()
  const geo = useGeolocation()
  const [notice, setNotice] = useState<string | null>(null)
  const [stopOpen, setStopOpen] = useState(false)
  const [manual, setManual] = useState({ lat: '', lng: '' })

  const share = useCommand<LocationReceipt>({
    onSuccess: (response) => {
      onPreview(null)
      if (response.data.accepted) {
        setNotice(null)
        void queryClient.invalidateQueries({ queryKey: exploreKeys.location(userId) })
      } else {
        setNotice(NOT_UPDATED[response.data.reason as keyof typeof NOT_UPDATED] ?? 'The location was not used.')
      }
    },
  })
  const stop = useCommand<void>({
    onSuccess: () => {
      setStopOpen(false)
      void queryClient.invalidateQueries({ queryKey: exploreKeys.location(userId) })
      queryClient.removeQueries({ queryKey: ['user', userId, 'nearby'] })
    },
  })

  const submitPreview = () => {
    if (!preview) return
    if (Date.now() - preview.receivedAt > PREVIEW_MAX_AGE_MS) {
      onPreview(null)
      setNotice('That reading is more than 30 seconds old. Locate again to share where you are now.')
      return
    }
    setNotice(null)
    share.start({
      method: 'POST',
      path: '/map/v1/location',
      body: {
        user_id: userId,
        lat: preview.lat,
        lng: preview.lng,
        // A new observation is stamped when it is shared; an explicit retry reuses this body.
        timestamp: new Date().toISOString(),
        ...(preview.accuracy_m !== null ? { accuracy_m: preview.accuracy_m } : {}),
      },
      idempotent: true,
      parse: (value) => locationReceiptSchema.parse(value),
      actor: userId,
    })
  }

  const manualSubmit = (event: FormEvent) => {
    event.preventDefault()
    const lat = Number(manual.lat)
    const lng = Number(manual.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      setNotice('Enter a latitude between -90 and 90 and a longitude between -180 and 180.')
      return
    }
    setNotice(null)
    onPreview({ lat, lng, accuracy_m: null, receivedAt: Date.now() })
  }

  return (
    <section className={styles.hud} aria-labelledby="explore-title">
      <div className={styles.hudTop}>
        <div className={styles.hudStatus}>
          <h1 id="explore-title" className={styles.hudTitle}>
            Explore
          </h1>
          <p className={styles.hudText} role="status">
            {location === null
              ? 'You have not shared a location yet.'
              : expired
                ? `Your shared location expired ${formatRelative(location.expires_at, now)}.`
                : (
                    <span title={formatAbsolute(location.timestamp)}>
                      Shared {formatRelative(location.timestamp, now)} · expires {formatRelative(location.expires_at, now)}
                    </span>
                  )}
          </p>
        </div>
        <div className={styles.hudActions}>
          <Button
            variant="primary"
            icon={<LocateFixed size={18} aria-hidden="true" />}
            busy={geo.locating}
            onClick={() => geo.locate(onPreview)}
            disabled={share.pending}
          >
            {location && !expired ? 'Update location' : 'Share location'}
          </Button>
          <Button
            variant="secondary"
            icon={<RefreshCw size={18} aria-hidden="true" />}
            onClick={props.onRefresh}
            busy={props.refreshing}
            disabled={!props.canRefresh}
            aria-label="Refresh nearby players"
            title="Refresh nearby players"
          />
          {location && !expired && (
            <Button
              variant="secondary"
              icon={<EyeOff size={18} aria-hidden="true" />}
              onClick={() => setStopOpen(true)}
              aria-label="Stop sharing location"
              title="Stop sharing location"
            />
          )}
        </div>
      </div>

      {preview && (
        <div className={styles.preview}>
          <p>
            <strong>Share this location?</strong> {preview.lat.toFixed(5)}, {preview.lng.toFixed(5)}
            {preview.accuracy_m !== null && <> · accurate to about {formatDistance(preview.accuracy_m)}</>}
          </p>
          <p className={styles.muted}>Players near you will see you on their map until it expires. Nothing is tracked in the background.</p>
          <div className={styles.previewActions}>
            <Button variant="quiet" onClick={() => onPreview(null)} disabled={share.pending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitPreview} busy={share.pending}>
              Share
            </Button>
          </div>
        </div>
      )}

      {geo.failure && <FormAlert title="Location not available.">{GEO_FAILURE_TEXT[geo.failure]}</FormAlert>}
      {notice && <FormAlert title="Location not updated." tone="info">{notice}</FormAlert>}
      {share.error && (
        <FormAlert title={share.uncertain ? 'We could not confirm your location was saved.' : 'Location not saved.'} correlationId={isApiError(share.error) ? share.error.correlationId : null}>
          <p>
            {isApiError(share.error) && share.error.code === 'invalid_timestamp'
              ? 'The map refused the time of this reading. Check that your device clock is set automatically, then try again.'
              : describeApiError(share.error)}
          </p>
          {share.uncertain && (
            <Button variant="quiet" onClick={share.retry}>
              Retry same request
            </Button>
          )}
        </FormAlert>
      )}

      {config.manual_location_enabled && (
        <form className={styles.manual} onSubmit={manualSubmit} aria-label="Manual coordinates (test mode)">
          <input aria-label="Latitude" inputMode="decimal" placeholder="Latitude" value={manual.lat} onChange={(event) => setManual({ ...manual, lat: event.target.value })} />
          <input aria-label="Longitude" inputMode="decimal" placeholder="Longitude" value={manual.lng} onChange={(event) => setManual({ ...manual, lng: event.target.value })} />
          <Button type="submit" variant="secondary" icon={<Crosshair size={16} aria-hidden="true" />}>
            Preview
          </Button>
        </form>
      )}

      <ConfirmDialog
        open={stopOpen}
        title="Stop sharing your location?"
        confirmLabel="Stop sharing"
        tone="danger"
        busy={stop.pending}
        onClose={() => {
          setStopOpen(false)
          stop.reset()
        }}
        onConfirm={() => stop.start({ method: 'DELETE', path: apiPath`/map/v1/location/${userId}`, idempotent: false, actor: userId })}
        feedback={stop.error ? <FormAlert title="Still shared." correlationId={isApiError(stop.error) ? stop.error.correlationId : null}>{describeApiError(stop.error)}</FormAlert> : null}
      >
        <p>Your location is removed from the map. Other players stop seeing you.</p>
      </ConfirmDialog>
    </section>
  )
}
