import { z } from 'zod'

const DEFAULT_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const DEFAULT_MAP_CENTER: [number, number] = [28.8638, 47.0105]

const sameOriginPath = z
  .string()
  .regex(/^\/[A-Za-z0-9._~/-]*$/, 'must be a same-origin path such as /api')
  .refine((value) => !value.startsWith('//'), 'must not be protocol-relative')
  .transform((value) => (value.length > 1 ? value.replace(/\/+$/, '') : value))

const httpsUrl = z.url({ protocol: /^https$/, error: 'must be an https URL' })

const socketOrigin = z.string().refine((value) => {
  try {
    const url = new URL(value)
    return (url.protocol === 'ws:' || url.protocol === 'wss:') && url.origin === value
  } catch {
    return false
  }
}, 'must be a ws:// or wss:// origin without path')

const longitude = z.number().min(-180).max(180)
const latitude = z.number().min(-90).max(90)

const presentationKey = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'must be a presentation key')
const configVersionKey = z.string().regex(/^[1-9]\d{0,9}$/, 'must be a positive config_version')

/**
 * Public runtime configuration. Strict: unknown keys are refused so a typo or a
 * misplaced secret is reported instead of silently ignored.
 */
export const clientConfigSchema = z.strictObject({
  api_base: sameOriginPath.default('/api'),
  map_style_url: httpsUrl.default(DEFAULT_MAP_STYLE_URL),
  map_default_center: z.tuple([longitude, latitude]).default(DEFAULT_MAP_CENTER),
  diagnostics_enabled: z.boolean().default(false),
  manual_location_enabled: z.boolean().default(false),
  allowed_socket_origins: z.array(socketOrigin).max(20).default([]),
  /** package_id -> config_version -> bundled presentation key */
  package_presentations: z
    .record(z.uuid(), z.record(configVersionKey, presentationKey))
    .default({}),
  /** Browser push is not implemented; only the disabled value is accepted. */
  push: z.null().default(null),
})

export type ClientConfig = z.output<typeof clientConfigSchema>

export class ClientConfigError extends Error {
  readonly issues: string[]

  constructor(message: string, issues: string[] = []) {
    super(message)
    this.name = 'ClientConfigError'
    this.issues = issues
  }
}

export function parseClientConfig(input: unknown): ClientConfig {
  const result = clientConfigSchema.safeParse(input)
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
      return `${path}: ${issue.message}`
    })
    throw new ClientConfigError('client-config.json is invalid.', issues)
  }
  return result.data
}

export async function loadClientConfig(
  fetchImpl: typeof fetch = fetch,
  url = '/client-config.json',
): Promise<ClientConfig> {
  let response: Response
  try {
    response = await fetchImpl(url, {
      cache: 'no-store',
      redirect: 'error',
      headers: { Accept: 'application/json' },
    })
  } catch {
    throw new ClientConfigError('client-config.json could not be loaded.')
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok || !contentType.includes('json')) {
    throw new ClientConfigError(
      `client-config.json could not be loaded (HTTP ${response.status}, ${contentType || 'no content type'}).`,
    )
  }
  let json: unknown
  try {
    json = await response.json()
  } catch {
    throw new ClientConfigError('client-config.json is not valid JSON.')
  }
  return parseClientConfig(json)
}
