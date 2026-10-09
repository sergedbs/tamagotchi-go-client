import { useState } from 'react'
import { List, Map as MapIcon } from 'lucide-react'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { useConfig } from '../../app/configContext.ts'
import { Button } from '../../components/Button.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { LoadProblem } from '../../components/LoadProblem.tsx'
import { useNow } from '../../lib/useNow.ts'
import { useAuthenticated } from '../auth/sessionContext.ts'
import { mergeBatches, useExpired, useNearby, useOwnLocation } from './api.ts'
import { LocationControl } from './LocationControl.tsx'
import { MapCanvas, type MapFailure } from './MapCanvas.tsx'
import { NearbyList } from './NearbyList.tsx'
import { PlayerSheet } from './PlayerSheet.tsx'
import type { Fix } from './useGeolocation.ts'
import styles from './Explore.module.css'

const FAILURE_TEXT: Record<MapFailure, string> = {
  webgl: 'This browser cannot draw the map (WebGL is unavailable).',
  provider: 'Map tiles could not be loaded from the map provider.',
}

export default function ExplorePage() {
  const { user } = useAuthenticated()
  const config = useConfig()
  const now = useNow()
  const location = useOwnLocation(user.user_id)
  const own = location.data ?? null
  const expired = useExpired(own?.expires_at, now)
  const fresh = !!own && !expired
  const nearby = useNearby(user.user_id, own, fresh)
  const [view, setView] = useState<'map' | 'list'>('map')
  const [mapFailure, setMapFailure] = useState<MapFailure | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState<Fix | null>(null)

  // Stale pins are never shown as current: an expired observation hides the result set.
  const merged = fresh ? mergeBatches(nearby.data?.pages) : { markers: [], partial: false, restarted: false, retrievedAt: null }
  const markers = merged.markers
  const selected = markers.find((marker) => marker.user_id === selectedId) ?? null
  const showList = view === 'list' || mapFailure !== null
  const center: [number, number] = own ? [own.lng, own.lat] : config.map_default_center

  const nearbyError = nearby.error
  const viewerMissing = isApiError(nearbyError) && nearbyError.code === 'viewer_location_unavailable'
  const truncated = nearby.hasNextPage

  return (
    <div className={styles.explore}>
      <div className={styles.frame}>
        {!mapFailure && (
          <div className={showList ? styles.mapHidden : styles.mapLayer} aria-hidden={showList || undefined}>
            <MapCanvas
              styleUrl={config.map_style_url}
              center={center}
              own={fresh ? own : null}
              preview={preview}
              markers={markers}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onFailure={setMapFailure}
            />
            {!own && !location.isPending && <p className={styles.defaultView}>Default view — not your location</p>}
          </div>
        )}

        <div className={styles.overlay}>
          {location.isError ? (
            <LoadProblem
              title="Your location could not be checked"
              message={describeApiError(location.error)}
              correlationId={isApiError(location.error) ? location.error.correlationId : null}
              onRetry={() => void location.refetch()}
            />
          ) : (
            <LocationControl
              userId={user.user_id}
              location={location.isPending ? null : own}
              expired={expired}
              now={now}
              preview={preview}
              onPreview={setPreview}
              onRefresh={() => void nearby.refetch()}
              refreshing={nearby.isFetching}
              canRefresh={fresh}
            />
          )}

          <div className={styles.notices}>
            {mapFailure && (
              <FormAlert title="Map unavailable." tone="info">
                {FAILURE_TEXT[mapFailure]} Nearby players are listed instead.
              </FormAlert>
            )}
            {fresh && merged.partial && (
              <FormAlert title="Only close strangers are shown." tone="info">
                Relationships are unavailable right now, so friends and enemies further away are missing.
              </FormAlert>
            )}
            {fresh && viewerMissing && (
              <FormAlert title="The map has no fresh location for you." tone="info">
                Share your location again to see who is nearby.
              </FormAlert>
            )}
            {fresh && nearbyError && !viewerMissing && (
              <FormAlert title="Nearby players could not be loaded." correlationId={isApiError(nearbyError) ? nearbyError.correlationId : null}>
                {describeApiError(nearbyError)}{' '}
                <Button variant="quiet" onClick={() => void nearby.refetch()}>
                  Try again
                </Button>
              </FormAlert>
            )}
          </div>

          <div className={styles.resultsBar}>
            <p className={styles.count} role="status">
              {!fresh
                ? own
                  ? 'Update your location to see nearby players.'
                  : 'Share your location to see nearby players.'
                : nearby.isPending
                  ? 'Looking for players nearby…'
                  : nearby.isSuccess
                    ? markers.length === 0
                      ? 'No one is nearby right now.'
                      : `${markers.length} player${markers.length === 1 ? '' : 's'} nearby${truncated ? ' (more available)' : ''}`
                    : ''}
            </p>
            {!mapFailure && (
              <div className={styles.toggle} role="group" aria-label="View">
                <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>
                  <MapIcon size={16} aria-hidden="true" /> Map
                </button>
                <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
                  <List size={16} aria-hidden="true" /> List
                </button>
              </div>
            )}
          </div>
        </div>

        {showList && (
          <div className={styles.listLayer}>
            {markers.length > 0 ? (
              <NearbyList markers={markers} now={now} selectedId={selectedId} onSelect={setSelectedId} />
            ) : (
              <p className={styles.muted}>{fresh && nearby.isSuccess ? 'No players returned.' : 'No current results.'}</p>
            )}
          </div>
        )}

        {truncated && (
          <div className={styles.more}>
            <Button variant="secondary" busy={nearby.isFetchingNextPage} onClick={() => void nearby.fetchNextPage()}>
              Load more players
            </Button>
          </div>
        )}

        {selected && <PlayerSheet marker={selected} now={now} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  )
}
