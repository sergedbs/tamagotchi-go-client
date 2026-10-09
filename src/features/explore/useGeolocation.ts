import { useState } from 'react'

export interface Fix {
  lat: number
  lng: number
  accuracy_m: number | null
  /**
   * When the browser delivered the reading (ms). Device fix times can be minutes
   * old (cached OS locations), so freshness is measured from delivery.
   */
  receivedAt: number
}

export type GeoFailure = 'insecure' | 'unsupported' | 'denied' | 'unavailable' | 'timeout'

export const GEO_FAILURE_TEXT: Record<GeoFailure, string> = {
  insecure: 'Location needs a secure page (HTTPS or localhost).',
  unsupported: 'This browser cannot provide a location.',
  denied: 'Location permission is blocked for this site. You can still use a fresh location you shared earlier.',
  unavailable: 'Your device could not determine a location right now.',
  timeout: 'Finding your location took too long. Try again.',
}

/** One-shot location, requested only from a user gesture. No background tracking. */
export function useGeolocation() {
  const [locating, setLocating] = useState(false)
  const [failure, setFailure] = useState<GeoFailure | null>(null)

  const locate = (onFix: (fix: Fix) => void) => {
    setFailure(null)
    if (!window.isSecureContext) return setFailure('insecure')
    if (!('geolocation' in navigator)) return setFailure('unsupported')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        onFix({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy_m: Number.isFinite(position.coords.accuracy) ? Math.min(100_000, position.coords.accuracy) : null,
          receivedAt: Date.now(),
        })
      },
      (error) => {
        setLocating(false)
        setFailure(error.code === error.PERMISSION_DENIED ? 'denied' : error.code === error.TIMEOUT ? 'timeout' : 'unavailable')
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
  }

  return { locating, failure, locate, clearFailure: () => setFailure(null) }
}
