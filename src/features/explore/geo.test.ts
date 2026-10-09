import { describe, expect, it } from 'vitest'
import { formatDistance, markerLabel, toLngLat } from './geo.ts'

describe('geo helpers', () => {
  it('orders coordinates as [lng, lat] for MapLibre', () => {
    expect(toLngLat({ lat: 47.0105, lng: 28.8638 })).toEqual([28.8638, 47.0105])
  })

  it('formats distances', () => {
    expect(formatDistance(4.4)).toBe('4 m')
    expect(formatDistance(1530)).toBe('1.5 km')
    expect(formatDistance(25_400)).toBe('25 km')
  })

  it('labels markers with relationship text, not colour alone', () => {
    expect(markerLabel({ user_id: 'u', lat: 0, lng: 0, timestamp: '', distance_m: 5, relationship: 'enemy' }, 'leon')).toBe('leon, enemy, 5 m away')
  })
})
