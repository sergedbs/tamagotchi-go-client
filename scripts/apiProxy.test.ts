// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { API_PREFIX, apiProxy, resolveGatewayUpstream, stripApiPrefix, upstreamProblem } from './apiProxy.ts'

describe('stripApiPrefix', () => {
  it('removes /api exactly once and keeps the service prefix', () => {
    expect(stripApiPrefix('/api/users/v1/users/me')).toBe('/users/v1/users/me')
    expect(stripApiPrefix('/api/api/health')).toBe('/api/health')
    expect(stripApiPrefix('/api/registry/v1/packages?limit=25')).toBe('/registry/v1/packages?limit=25')
    expect(stripApiPrefix('/api')).toBe('/')
    expect(stripApiPrefix('/api?x=1')).toBe('/?x=1')
  })

  it('only matches the /api segment', () => {
    expect(API_PREFIX.test('/apiary')).toBe(false)
    expect(API_PREFIX.test('/creatures')).toBe(false)
    expect(API_PREFIX.test('/api/health')).toBe(true)
  })
})

describe('resolveGatewayUpstream', () => {
  it('defaults to the documented local Gateway', () => {
    expect(resolveGatewayUpstream(undefined)).toBe('http://127.0.0.1:3000')
    expect(resolveGatewayUpstream('  ')).toBe('http://127.0.0.1:3000')
  })

  it('accepts a fixed origin', () => {
    expect(resolveGatewayUpstream('http://127.0.0.1:13000')).toBe('http://127.0.0.1:13000')
    expect(resolveGatewayUpstream('https://gateway.example.test/')).toBe('https://gateway.example.test')
  })

  it.each(['not a url', 'ftp://host', 'http://host/api', 'http://user:pw@host', 'http://host?x=1'])(
    'refuses %s',
    (value) => {
      expect(() => resolveGatewayUpstream(value)).toThrow()
    },
  )
})

describe('upstream problem', () => {
  it('is a complete Problem without echoing the query string', () => {
    const problem = upstreamProblem('/users/v1/users/me')
    expect(problem).toMatchObject({ status: 502, code: 'upstream_unavailable', instance: '/users/v1/users/me' })
    expect(problem.correlation_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('configures a single fixed, non-redirecting upstream', () => {
    const [entry] = Object.values(apiProxy('http://127.0.0.1:13000'))
    expect(entry).toMatchObject({ target: 'http://127.0.0.1:13000', followRedirects: false, ws: false })
  })
})
