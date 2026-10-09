import { describe, expect, it, vi } from 'vitest'
import { ClientConfigError, loadClientConfig, parseClientConfig } from './config.ts'

const PACKAGE_ID = '01a11d09-508b-7095-80e3-cb2c2db6eca5'

describe('parseClientConfig', () => {
  it('applies safe defaults for missing optional values', () => {
    expect(parseClientConfig({})).toEqual({
      api_base: '/api',
      map_style_url: 'https://tiles.openfreemap.org/styles/liberty',
      map_default_center: [28.8638, 47.0105],
      diagnostics_enabled: false,
      manual_location_enabled: false,
      allowed_socket_origins: [],
      package_presentations: {},
      push: null,
    })
  })

  it('accepts the committed local configuration shape', () => {
    const config = parseClientConfig({
      api_base: '/api/',
      allowed_socket_origins: ['ws://localhost:13004', 'wss://guild.example.test'],
      package_presentations: { [PACKAGE_ID]: { '1': 'grove-companions' } },
    })
    expect(config.api_base).toBe('/api')
    expect(config.package_presentations[PACKAGE_ID]?.['1']).toBe('grove-companions')
  })

  it.each([
    [{ api_base: 'https://gateway.example.test' }, 'api_base'],
    [{ api_base: '//evil.example.test' }, 'api_base'],
    [{ map_style_url: 'http://tiles.example.test/style.json' }, 'map_style_url'],
    [{ map_default_center: [47.0105, 191] }, 'map_default_center'],
    [{ allowed_socket_origins: ['ws://localhost:13004/v1/chat'] }, 'allowed_socket_origins'],
    [{ allowed_socket_origins: ['https://localhost:13004'] }, 'allowed_socket_origins'],
    [{ package_presentations: { 'not-a-uuid': { '1': 'grove' } } }, 'package_presentations'],
    [{ package_presentations: { [PACKAGE_ID]: { '0': 'grove' } } }, 'package_presentations'],
    [{ push: { provider: 'firebase' } }, 'push'],
  ])('refuses invalid value %j', (input, field) => {
    expect(() => parseClientConfig(input)).toThrowError(ClientConfigError)
    try {
      parseClientConfig(input)
    } catch (error) {
      expect((error as ClientConfigError).issues.join('\n')).toContain(field)
    }
  })

  it('refuses unknown keys so secrets cannot hide in public config', () => {
    expect(() => parseClientConfig({ service_secret: 'x' })).toThrowError(ClientConfigError)
    expect(() => parseClientConfig({ admin_password: 'x' })).toThrowError(ClientConfigError)
  })
})

describe('loadClientConfig', () => {
  const json = (body: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
      ...init,
    })

  it('loads without caching and validates', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json({ diagnostics_enabled: true }))
    const config = await loadClientConfig(fetchImpl)
    expect(config.diagnostics_enabled).toBe(true)
    expect(fetchImpl).toHaveBeenCalledWith('/client-config.json', expect.objectContaining({ cache: 'no-store', redirect: 'error' }))
  })

  it('reports an HTML fallback instead of treating it as configuration', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }))
    await expect(loadClientConfig(fetchImpl)).rejects.toThrow(/could not be loaded/)
  })

  it('reports network failure and invalid JSON distinctly', async () => {
    await expect(loadClientConfig(vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline')))).rejects.toThrow(
      /could not be loaded/,
    )
    const broken = new Response('{', { headers: { 'content-type': 'application/json' } })
    await expect(loadClientConfig(vi.fn<typeof fetch>().mockResolvedValue(broken))).rejects.toThrow(/not valid JSON/)
  })
})
