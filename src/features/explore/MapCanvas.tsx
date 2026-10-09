import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Marker } from './dto.ts'
import { markerLabel, toLngLat } from './geo.ts'
import styles from './Explore.module.css'

export type MapFailure = 'webgl' | 'provider'

// The worker ships as one self-contained module; point MapLibre at the emitted asset.
maplibregl.setWorkerUrl(workerUrl)

interface MapCanvasProps {
  styleUrl: string
  center: [number, number]
  own: { lat: number; lng: number } | null
  /** Unconfirmed preview of a new observation, shown distinctly. */
  preview: { lat: number; lng: number } | null
  markers: Marker[]
  selectedId: string | null
  onSelect: (userId: string) => void
  onFailure: (failure: MapFailure) => void
}

// Static, trusted icon markup (Lucide geometry); no data is ever inserted as HTML.
const ICONS: Record<Marker['relationship'], string> = {
  friend: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  enemy:
    '<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/>',
  stranger: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
}

function markerElement(marker: Marker, onSelect: (id: string) => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = styles.pin ?? ''
  button.dataset.relationship = marker.relationship
  button.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[marker.relationship]}</svg>`
  button.addEventListener('click', (event) => {
    event.stopPropagation()
    onSelect(button.dataset.userId ?? marker.user_id)
  })
  return button
}

function ownElement(className: string | undefined, label: string): HTMLDivElement {
  const element = document.createElement('div')
  element.className = className ?? ''
  element.setAttribute('role', 'img')
  element.setAttribute('aria-label', label)
  return element
}

export function MapCanvas({ styleUrl, center, own, preview, markers, selectedId, onSelect, onFailure }: MapCanvasProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const pins = useRef(new Map<string, maplibregl.Marker>())
  const ownPin = useRef<maplibregl.Marker | null>(null)
  const previewPin = useRef<maplibregl.Marker | null>(null)
  const callbacks = useRef({ onSelect, onFailure })
  useEffect(() => {
    callbacks.current = { onSelect, onFailure }
  })

  useEffect(() => {
    if (!container.current) return
    let instance: maplibregl.Map
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: styleUrl,
        center,
        zoom: 15,
        attributionControl: { compact: false },
        cooperativeGestures: false,
      })
    } catch {
      callbacks.current.onFailure('webgl')
      return
    }
    map.current = instance
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    let loaded = false
    const timeout = window.setTimeout(() => !loaded && callbacks.current.onFailure('provider'), 12_000)
    instance.on('load', () => {
      loaded = true
      window.clearTimeout(timeout)
    })
    instance.on('error', () => {
      if (!loaded) callbacks.current.onFailure('provider')
    })
    const markersOnMap = pins.current
    return () => {
      window.clearTimeout(timeout)
      markersOnMap.clear()
      ownPin.current = null
      previewPin.current = null
      instance.remove()
      map.current = null
    }
    // The map is created once; later center changes move the camera below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl])

  // Replace the complete marker set: update existing, add new, remove absent.
  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const next = new Set(markers.map((marker) => marker.user_id))
    for (const [id, pin] of pins.current) {
      if (!next.has(id)) {
        pin.remove()
        pins.current.delete(id)
      }
    }
    for (const marker of markers) {
      let pin = pins.current.get(marker.user_id)
      if (!pin) {
        const element = markerElement(marker, (id) => callbacks.current.onSelect(id))
        element.dataset.userId = marker.user_id
        pin = new maplibregl.Marker({ element }).setLngLat(toLngLat(marker)).addTo(instance)
        pins.current.set(marker.user_id, pin)
      } else {
        pin.setLngLat(toLngLat(marker))
      }
      const element = pin.getElement()
      element.dataset.relationship = marker.relationship
      element.setAttribute('aria-label', markerLabel(marker))
      element.setAttribute('aria-pressed', String(marker.user_id === selectedId))
    }
  }, [markers, selectedId])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    ownPin.current?.remove()
    ownPin.current = own ? new maplibregl.Marker({ element: ownElement(styles.ownPin, 'Your shared location') }).setLngLat(toLngLat(own)).addTo(instance) : null
    if (own) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) instance.jumpTo({ center: toLngLat(own) })
      else instance.easeTo({ center: toLngLat(own), duration: 240 })
    }
  }, [own])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    previewPin.current?.remove()
    previewPin.current = preview
      ? new maplibregl.Marker({ element: ownElement(styles.previewPin, 'Location preview, not shared yet') }).setLngLat(toLngLat(preview)).addTo(instance)
      : null
    if (preview) instance.jumpTo({ center: toLngLat(preview) })
  }, [preview])

  return <div ref={container} className={styles.map} aria-label="Map of nearby players" role="region" />
}
