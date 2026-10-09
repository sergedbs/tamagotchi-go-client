import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { ApiError } from '../../src/api/errors.ts'
import { sendRequest, type ApiRequest } from '../../src/api/http.ts'
import { authoredPackageSchema, PUBLIC_ORIGIN_PLACEHOLDER, type AuthoredPackage } from '../../src/packages/schema.ts'
import type { CliOptions } from './args.ts'
import { Ledger } from './ledger.ts'

export interface AdminCredentials {
  email: string
  password: string
  package_id: string
  gateway_url?: string
}

export interface Io {
  fetch: typeof fetch
  log: (line: string) => void
  root: string
  now: () => Date
  sleep: (ms: number) => Promise<void>
}

/** Replaces any known secret value before anything is printed. */
export function redactor(secrets: () => string[]) {
  return (line: string) => secrets().filter((value) => value.length >= 4).reduce((text, value) => text.split(value).join('[redacted]'), line)
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T
}

export function loadAdmin(root: string, gateway: string): AdminCredentials {
  const file = join(root, '.local', 'admin-credentials.json')
  if (!existsSync(file)) throw new Error('Missing .local/admin-credentials.json (operator-supplied, private).')
  const admin = readJson<Partial<AdminCredentials>>(file)
  if (typeof admin.email !== 'string' || typeof admin.password !== 'string' || typeof admin.package_id !== 'string') {
    throw new Error('.local/admin-credentials.json needs email, password and package_id.')
  }
  if (admin.gateway_url && new URL(admin.gateway_url).origin !== new URL(gateway).origin) {
    throw new Error('Admin credentials are for a different Gateway than the selected target; refusing.')
  }
  return admin as AdminCredentials
}

export function loadAuthoredPackages(root: string): AuthoredPackage[] {
  const dir = join(root, 'src', 'packages', 'authored')
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => authoredPackageSchema.parse(readJson(join(dir, file))))
}

/** Strips presentation-only fields and fills the supplied public asset origin. */
export function registryDefinition(authored: AuthoredPackage, publicOrigin: string) {
  return {
    ...authored.definition,
    assets: authored.definition.assets.map((asset) => ({ ...asset, url: asset.url.replace(PUBLIC_ORIGIN_PLACEHOLDER, publicOrigin) })),
  }
}

class Client {
  token: string | null = null
  private readonly gateway: string
  private readonly io: Io
  constructor(gateway: string, io: Io) {
    this.gateway = gateway
    this.io = io
  }
  request<T>(request: ApiRequest<T>) {
    return sendRequest(request, { baseUrl: this.gateway, accessToken: this.token, fetchImpl: this.io.fetch })
  }
  async login(email: string, password: string, packageId: string) {
    const { data } = await this.request<{ access_token: string }>({
      method: 'POST',
      path: '/users/v1/users/login',
      auth: 'public',
      body: { email, password, package_id: packageId },
    })
    this.token = data.access_token
    const me = await this.request<{ user_id: string; username: string; package_ids: string[] }>({ method: 'GET', path: '/users/v1/users/me', auth: 'user' })
    return me.data
  }
}

function describe(error: unknown): string {
  if (error instanceof ApiError) return `${error.kind} ${error.status ?? ''} ${error.code ?? ''} correlation=${error.correlationId ?? 'none'}`.trim()
  return error instanceof Error ? error.message : String(error)
}

async function check(io: Io, label: string, action: () => Promise<string>): Promise<{ label: string; ok: boolean; detail: string }> {
  try {
    const detail = await action()
    io.log(`  ok    ${label}: ${detail}`)
    return { label, ok: true, detail }
  } catch (error) {
    const detail = describe(error)
    io.log(`  FAIL  ${label}: ${detail}`)
    return { label, ok: false, detail }
  }
}

/** Read-only readiness check (docs/ENVIRONMENT.md). Signs in, never writes data. */
export async function preflight(options: CliOptions, io: Io) {
  const admin = loadAdmin(io.root, options.target.gateway)
  const client = new Client(options.target.gateway, io)
  io.log(`Preflight against ${options.target.name} (${options.target.gateway})`)
  let userId = ''
  const results = [
    await check(io, 'health', async () => JSON.stringify((await client.request({ method: 'GET', path: '/health', auth: 'public' })).data)),
    await check(io, 'ready', async () => JSON.stringify((await client.request({ method: 'GET', path: '/ready', auth: 'public' })).data)),
    await check(io, 'public packages', async () => {
      const { data } = await client.request<{ items: { package_id: string; config_version: number | null; status: string }[] }>({
        method: 'GET',
        path: '/registry/v1/packages',
        query: { limit: 25 },
        auth: 'public',
      })
      const bootstrap = data.items.some((item) => item.package_id === admin.package_id)
      return `${data.items.length} listed, ${data.items.filter((item) => item.config_version !== null).length} configured, bootstrap package ${bootstrap ? 'present' : 'not on first page'}`
    }),
    await check(io, 'public types', async () => `${((await client.request<{ types: string[] }>({ method: 'GET', path: '/tamagotchi/v1/types', auth: 'public' })).data.types ?? []).length} types`),
    await check(io, 'admin sign-in and /users/me', async () => {
      const me = await client.login(admin.email, admin.password, admin.package_id)
      userId = me.user_id
      return `identity loaded, ${me.package_ids.length} package membership(s)`
    }),
    await check(io, 'collection read', async () => {
      const { data } = await client.request<{ primary: unknown; secondary: unknown[] }>({ method: 'GET', path: `/tamagotchi/v1/users/${userId}/collection`, query: { limit: 25 }, auth: 'user' })
      return `primary ${data.primary ? 'present' : 'none'}, ${data.secondary.length} secondary`
    }),
    await check(io, 'nearby read', async () => {
      try {
        const { data } = await client.request<{ nearby: unknown[]; partial: boolean }>({ method: 'GET', path: `/map/v1/location/nearby/${userId}`, query: { limit: 1 }, auth: 'user' })
        return `${data.nearby.length} marker(s), partial=${data.partial}`
      } catch (error) {
        if (error instanceof ApiError && (error.code === 'viewer_location_unavailable' || error.status === 404)) {
          return `reachable; ${error.code ?? error.status} (no fresh own location, expected without a location write)`
        }
        throw error
      }
    }),
    await check(io, 'admin registry read', async () => {
      const { data } = await client.request<{ items: unknown[] }>({ method: 'GET', path: '/registry/v1/bosses', query: { limit: 1 }, auth: 'user' })
      return `boss list readable (${data.items.length} on first page)`
    }),
  ]
  const ok = results.every((result) => result.ok)
  const report = { target: options.target.name, at: io.now().toISOString(), mode: 'preflight', ok, results }
  const dir = join(io.root, '.local', 'reports')
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  writeFileSync(join(dir, `preflight-${options.target.name}-${report.at.replace(/[:.]/g, '-')}.json`), JSON.stringify(report, null, 2), { mode: 0o600 })
  io.log(ok ? 'Preflight passed.' : 'Preflight found failures; see above.')
  return report
}

/** Sends a ledger step exactly as saved; an uncertain outcome stays pending for resume. */
async function execute<T>(ledger: Ledger, client: Client, id: string, request: Omit<ApiRequest<T>, 'idempotencyKey'>, idempotent: boolean): Promise<T> {
  const step = ledger.plan(id, request.method, request.path, request.body, idempotent)
  if (step.status === 'done') return step.result as T
  if (step.status === 'failed') throw new Error(`Step ${id} failed earlier (${JSON.stringify(step.error)}); inspect before resuming.`)
  try {
    const { data } = await client.request<T>({ ...request, body: step.body, idempotencyKey: step.key ?? undefined })
    ledger.complete(id, data)
    return data
  } catch (error) {
    if (error instanceof ApiError && !error.uncertain) {
      ledger.fail(id, { status: error.status, code: error.code, correlation_id: error.correlationId })
    }
    throw new Error(`Step ${id}: ${describe(error)}${error instanceof ApiError && error.uncertain ? ' (outcome uncertain; resume re-sends the same command)' : ''}`, {
      cause: error,
    })
  }
}

export async function provision(options: CliOptions, io: Io, personas: { key: string; package: string }[]) {
  if (!options.runId || !options.confirmed) throw new Error('provision requires --run-id and --confirm-test-target.')
  const runId = options.runId
  const admin = loadAdmin(io.root, options.target.gateway)
  const ledger = new Ledger(join(io.root, '.local', 'fixtures', options.target.name, `${runId}.json`), options.target.name, runId)
  const client = new Client(options.target.gateway, io)
  const origin = options.target.public_client_origin
  const log = (line: string) => io.log(redactor(() => [admin.password, ...Object.values(ledger.data.secrets).map((secret) => secret.password)])(line))

  log(`Provision ${options.target.name} run ${runId}`)
  const me = await client.login(admin.email, admin.password, admin.package_id)
  const packages: Record<string, { package_id: string; config_version: number }> = {}

  for (const authored of loadAuthoredPackages(io.root)) {
    for (const asset of authored.definition.assets) {
      const url = asset.url.replace(PUBLIC_ORIGIN_PLACEHOLDER, origin)
      const response = await io.fetch(url, { method: 'GET' })
      if (!response.ok || !(response.headers.get('content-type') ?? '').startsWith('image/')) {
        throw new Error(`Artwork ${asset.sprite_ref} is not served at ${url} (HTTP ${response.status}). Start the client first.`)
      }
    }
    const created = await execute<{ package_id: string; revision: number }>(
      ledger,
      client,
      `package:${authored.key}`,
      {
        method: 'POST',
        path: '/registry/v1/packages',
        auth: 'user',
        body: { ...authored.package, name: `${authored.package.name} ${runId}`.slice(0, 64), developer_user_ids: [me.user_id], moderator_user_ids: [me.user_id] },
      },
      true,
    )
    // A saved step is revalidated against the target before it is relied on.
    await client.request({ method: 'GET', path: `/registry/v1/packages/${created.package_id}`, auth: 'public' })
    const config = await execute<{ config_version: number }>(
      ledger,
      client,
      `config:${authored.key}`,
      {
        method: 'PUT',
        path: `/registry/v1/packages/${created.package_id}/stats`,
        auth: 'user',
        body: { expected_package_revision: created.revision, definition: registryDefinition(authored, origin) },
      },
      true,
    )
    packages[authored.key] = { package_id: created.package_id, config_version: config.config_version }
    log(`  package ${authored.key}: config_version ${config.config_version}`)
  }
  ledger.data.facts.packages = packages
  ledger.save()

  const users: Record<string, { user_id: string; username: string; starter: string | null }> = {}
  for (const persona of personas) {
    const pkg = packages[persona.package]
    if (!pkg) throw new Error(`Persona ${persona.key} needs package ${persona.package}`)
    ledger.data.secrets[persona.key] ??= { email: `${persona.key}+${runId}@example.test`, password: randomBytes(18).toString('base64url') }
    ledger.save()
    const secret = ledger.data.secrets[persona.key]!
    await execute(
      ledger,
      client,
      `register:${persona.key}`,
      { method: 'POST', path: '/users/v1/users/register', auth: 'public', body: { username: `${persona.key}-${runId}`, email: secret.email, password: secret.password, package_id: pkg.package_id } },
      true,
    )
    const user = new Client(options.target.gateway, io)
    const profile = await user.login(secret.email, secret.password, pkg.package_id)
    let starter: string | null = null
    for (let attempt = 0; attempt < 30 && !starter; attempt++) {
      const { data } = await user.request<{ primary: { name: string } | null }>({ method: 'GET', path: `/tamagotchi/v1/users/${profile.user_id}/collection`, query: { limit: 25 }, auth: 'user' })
      starter = data.primary?.name ?? null
      if (!starter) await io.sleep(1000)
    }
    users[persona.key] = { user_id: profile.user_id, username: profile.username, starter }
    log(`  persona ${persona.key}: ${starter ? `starter ${starter}` : 'starter not created within 30 s'}`)
  }
  ledger.data.facts.users = users
  ledger.save()

  const mapping = Object.fromEntries(Object.entries(packages).map(([key, value]) => [value.package_id, { [String(value.config_version)]: key }]))
  const dir = join(io.root, '.local', 'fixtures', options.target.name)
  writeFileSync(join(dir, `${runId}.manifest.json`), JSON.stringify({ target: options.target.name, run_id: runId, packages, users }, null, 2), { mode: 0o600 })
  if (options.writeClientConfig) {
    const file = join(io.root, 'public', 'client-config.json')
    const config = readJson<{ package_presentations?: Record<string, Record<string, string>> }>(file)
    config.package_presentations = { ...config.package_presentations, ...mapping }
    writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`)
    log('  public/client-config.json package_presentations updated.')
  } else {
    log(`  package_presentations to add: ${JSON.stringify(mapping)}`)
  }
  log('Provision complete.')
  return { packages, users }
}
