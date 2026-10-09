import { describe, expect, it } from 'vitest'
import { resolveSpriteUrl, safeAssetUrl } from './assets.ts'

const ORIGIN = 'http://localhost:5173'

describe('safeAssetUrl', () => {
  it('accepts https anywhere and http only on the page origin', () => {
    expect(safeAssetUrl('https://cdn.example.test/a.png', ORIGIN)).toBe('https://cdn.example.test/a.png')
    expect(safeAssetUrl('http://localhost:5173/assets/a.png', ORIGIN)).toBe('http://localhost:5173/assets/a.png')
    expect(safeAssetUrl('/assets/a.png', ORIGIN)).toBe('http://localhost:5173/assets/a.png')
    expect(safeAssetUrl('http://evil.example.test/a.png', ORIGIN)).toBeNull()
    expect(safeAssetUrl('javascript:alert(1)', ORIGIN)).toBeNull()
    expect(safeAssetUrl('data:image/svg+xml,<svg/>', ORIGIN)).toBeNull()
    expect(safeAssetUrl('https://user:pw@cdn.example.test/a.png', ORIGIN)).toBeNull()
  })

  it('maps only explicitly configured bundled artwork origins to the tunnel origin', () => {
    const tunnel = 'https://demo.ngrok-free.app'
    const origins = ['http://localhost:5173']
    expect(safeAssetUrl('http://localhost:5173/assets/creatures/lythbound/wolfren/green.png', tunnel, origins))
      .toBe(`${tunnel}/assets/creatures/lythbound/wolfren/green.png`)
    expect(safeAssetUrl('http://localhost:5173/api/private', tunnel, origins)).toBeNull()
    expect(safeAssetUrl('http://localhost:9999/assets/creatures/a.png', tunnel, origins)).toBeNull()
    expect(safeAssetUrl('http://localhost:5173/assets/creatures/../../private', tunnel, origins)).toBeNull()
    expect(safeAssetUrl('http://user:pw@localhost:5173/assets/creatures/a.png', tunnel, origins)).toBeNull()
  })

  it('resolves a sprite through the manifest only', () => {
    const assets = { package_id: 'p', config_version: 1, items: [{ sprite_ref: 'a/b', url: 'https://cdn.example.test/b.png' }] }
    expect(resolveSpriteUrl(assets, 'a/b')).toBe('https://cdn.example.test/b.png')
    expect(resolveSpriteUrl(assets, 'a/c')).toBeNull()
    expect(resolveSpriteUrl(undefined, 'a/b')).toBeNull()
  })
})
