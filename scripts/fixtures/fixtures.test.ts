// @vitest-environment node
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseArgs, UsageError } from './args.ts'
import { Ledger } from './ledger.ts'
import { loadAdmin, loadAuthoredPackages, provision, redactor, registryDefinition, type Io } from './run.ts'

const TARGETS = { 'local-acceptance': { gateway: 'http://gw.test', public_client_origin: 'http://client.test', test_target: true }, prod: { gateway: 'https://prod', public_client_origin: 'https://prod', test_target: false } }
const ADMIN = { email: 'admin@example.test', password: 'super-secret-admin-pw', package_id: '01a11d09-508b-7095-80e3-cb2c2db6eca5', gateway_url: 'http://gw.test' }

let root: string
beforeEach(() => {
  const base = join(process.cwd(), '.local', 'test-tmp')
  mkdirSync(base, { recursive: true })
  root = mkdtempSync(join(base, 'fixtures-'))
  mkdirSync(join(root, '.local'), { recursive: true })
  writeFileSync(join(root, '.local', 'admin-credentials.json'), JSON.stringify(ADMIN))
  cpSync(join(process.cwd(), 'src', 'packages', 'authored'), join(root, 'src', 'packages', 'authored'), { recursive: true })
  mkdirSync(join(root, 'public'), { recursive: true })
  writeFileSync(join(root, 'public', 'client-config.json'), JSON.stringify({ api_base: '/api' }))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('parseArgs', () => {
  it.each([
    [[], /Usage/],
    [['provision'], /--target is required/],
    [['preflight', '--target', 'nowhere'], /Unknown target/],
    [['preflight', '--target', 'prod'], /not marked as a test target/],
    [['provision', '--target', 'local-acceptance'], /--run-id is required/],
    [['provision', '--target', 'local-acceptance', '--run-id', 'r1'], /--confirm-test-target local-acceptance is required/],
    [['provision', '--target', 'local-acceptance', '--run-id', 'r1', '--confirm-test-target', 'prod'], /--confirm-test-target/],
    [['scenario', '--target', 'local-acceptance'], /not implemented/],
  ])('refuses %j', (argv, message) => {
    expect(() => parseArgs(argv, TARGETS)).toThrow(UsageError)
    expect(() => parseArgs(argv, TARGETS)).toThrow(message)
  })

  it('accepts a confirmed provision', () => {
    expect(parseArgs(['provision', '--target', 'local-acceptance', '--run-id', 'demo1', '--confirm-test-target', 'local-acceptance'], TARGETS)).toMatchObject({
      mode: 'provision',
      runId: 'demo1',
      confirmed: true,
      writeClientConfig: false,
    })
  })
})

describe('Ledger', () => {
  it('keeps the exact body and key across resumes', () => {
    const file = join(root, '.local', 'fixtures', 't', 'r.json')
    const first = new Ledger(file, 't', 'r').plan('s', 'POST', '/x', { a: 1 }, true)
    const again = new Ledger(file, 't', 'r').plan('s', 'POST', '/x', { a: 2 }, true)
    expect(again.key).toBe(first.key)
    expect(again.body).toEqual({ a: 1 })
    expect(() => new Ledger(file, 't', 'other')).toThrow(/different target or run/)
  })
})

describe('helpers', () => {
  it('redacts secrets from output', () => {
    expect(redactor(() => ['hunter22secret'])('password hunter22secret leaked')).toBe('password [redacted] leaked')
  })

  it('strips presentation and fills the public origin', () => {
    const [grove] = loadAuthoredPackages(root)
    const definition = registryDefinition(grove!, 'http://client.test')
    expect(definition).not.toHaveProperty('presentation')
    expect(definition.assets[0]?.url).toBe('http://client.test/assets/creatures/lythbound/wolfren/green.png')
  })

  it('refuses admin credentials for another Gateway', () => {
    expect(() => loadAdmin(root, 'http://elsewhere.test')).toThrow(/different Gateway/)
    expect(loadAdmin(root, 'http://gw.test').email).toBe(ADMIN.email)
  })
})

describe('provision', () => {
  function fakeGateway(options: { loseFirstPackageReply?: boolean } = {}) {
    const calls: { method: string; path: string; key: string | null; body: unknown }[] = []
    let packageCount = 0
    let lost = options.loseFirstPackageReply ?? false
    const users = new Map<string, string>()
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } })
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      const headers = (init?.headers ?? {}) as Record<string, string>
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
      if (url.origin === 'http://client.test') return new Response('png', { status: 200, headers: { 'content-type': 'image/png' } })
      calls.push({ method: init?.method ?? 'GET', path: url.pathname, key: headers['Idempotency-Key'] ?? null, body })
      if (url.pathname === '/users/v1/users/login') return json(200, { access_token: `t-${body.email}`, refresh_token: 'r', token_type: 'Bearer', expires_in: 900 })
      if (url.pathname === '/users/v1/users/me') {
        const email = (headers.Authorization ?? '').replace('Bearer t-', '')
        return json(200, { user_id: users.get(email) ?? 'admin-id', username: email.split('@')[0], package_ids: [] })
      }
      if (url.pathname === '/registry/v1/packages') {
        if (lost) {
          lost = false
          throw new TypeError('socket hang up')
        }
        packageCount += 1
        return json(201, { package_id: `pkg-${packageCount}`, revision: 1 })
      }
      if (url.pathname.endsWith('/stats')) return json(200, { config_version: 1 })
      if (url.pathname.startsWith('/registry/v1/packages/pkg-')) return json(200, { package_id: url.pathname.split('/').at(-1) })
      if (url.pathname === '/users/v1/users/register') {
        users.set(body.email, `user-${users.size + 1}`)
        return json(201, { user: {}, global_currency: 0, starter_status: 'PENDING' })
      }
      if (url.pathname.endsWith('/collection')) return json(200, { primary: { name: 'Mossling' }, secondary: [] })
      return json(404, { status: 404, code: 'not_found' })
    }) as typeof fetch
    return { fetchImpl, calls }
  }

  function io(fetchImpl: typeof fetch, lines: string[]): Io {
    return { fetch: fetchImpl, log: (line) => lines.push(line), root, now: () => new Date('2026-10-09T12:00:00.000Z'), sleep: async () => undefined }
  }

  const options = parseArgs(['provision', '--target', 'local-acceptance', '--run-id', 'r1', '--confirm-test-target', 'local-acceptance'], TARGETS)
  const personas = [{ key: 'mira', package: 'grove-companions' }]

  it('resumes a lost reply with the same key and never prints credentials', async () => {
    const gateway = fakeGateway({ loseFirstPackageReply: true })
    const lines: string[] = []
    await expect(provision(options, io(gateway.fetchImpl, lines), personas)).rejects.toThrow(/outcome uncertain/)
    const result = await provision(options, io(gateway.fetchImpl, lines), personas)

    const packagePosts = gateway.calls.filter((call) => call.method === 'POST' && call.path === '/registry/v1/packages')
    expect(packagePosts[0]?.key).toBe(packagePosts[1]?.key)
    expect(packagePosts[1]?.body).toEqual(packagePosts[0]?.body)
    expect(result.users.mira?.starter).toBe('Mossling')

    const ledger = JSON.parse(readFileSync(join(root, '.local', 'fixtures', 'local-acceptance', 'r1.json'), 'utf8'))
    const output = lines.join('\n')
    expect(output).not.toContain(ADMIN.password)
    expect(output).not.toContain(ledger.secrets.mira.password)
    expect(output).toContain('package_presentations to add')

    const manifest = readFileSync(join(root, '.local', 'fixtures', 'local-acceptance', 'r1.manifest.json'), 'utf8')
    expect(manifest).not.toContain(ledger.secrets.mira.password)
    expect(manifest).not.toContain('@example.test')
  })

  it('does not repeat completed steps on a second run', async () => {
    const gateway = fakeGateway()
    await provision(options, io(gateway.fetchImpl, []), personas)
    const before = gateway.calls.filter((call) => call.method !== 'GET' && !call.path.endsWith('/login')).length
    await provision(options, io(gateway.fetchImpl, []), personas)
    const after = gateway.calls.filter((call) => call.method !== 'GET' && !call.path.endsWith('/login')).length
    expect(after).toBe(before)
  })
})
