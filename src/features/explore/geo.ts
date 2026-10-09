import type { Marker, Relationship } from './dto.ts'

/** MapLibre order is [lng, lat]; API objects carry lat/lng fields. */
export function toLngLat(point: { lat: number; lng: number }): [number, number] {
  return [point.lng, point.lat]
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return 'unknown distance'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`
}

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  friend: 'Friend',
  enemy: 'Enemy',
  stranger: 'Stranger',
}

export function markerLabel(marker: Marker, name?: string): string {
  return `${name ?? 'Player'}, ${RELATIONSHIP_LABEL[marker.relationship].toLowerCase()}, ${formatDistance(marker.distance_m)} away`
}
