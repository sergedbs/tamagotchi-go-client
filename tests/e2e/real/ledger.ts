import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'

/**
 * Private run ledger for real-target tests. Generated credentials are written to
 * .local/real-runs (ignored by Git) before use and never printed.
 */
const DIR = join(process.cwd(), '.local', 'real-runs')

export interface SyntheticUser {
  username: string
  email: string
  password: string
  packageId: string
}

const RUN_ID = process.env.E2E_RUN_ID ?? Date.now().toString(36)

/** One run id per test process, so every synthetic user of a run shares a ledger. */
export function runId(): string {
  return RUN_ID
}

export function bootstrapPackageId(): string {
  if (process.env.E2E_PACKAGE_ID) return process.env.E2E_PACKAGE_ID
  const file = join(process.cwd(), '.local', 'admin-credentials.json')
  if (!existsSync(file)) throw new Error('Set E2E_PACKAGE_ID or provide .local/admin-credentials.json with package_id')
  const value = JSON.parse(readFileSync(file, 'utf8')) as { package_id?: unknown }
  if (typeof value.package_id !== 'string') throw new Error('admin-credentials.json has no package_id')
  return value.package_id
}

export function newSyntheticUser(run: string, label: string, packageId: string): SyntheticUser {
  const user = {
    username: `e2e-${run}-${label}`.slice(0, 32),
    email: `e2e+${run}-${label}@example.test`,
    password: randomBytes(18).toString('base64url'),
    packageId,
  }
  mkdirSync(DIR, { recursive: true, mode: 0o700 })
  const file = join(DIR, `${run}.json`)
  const ledger = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, SyntheticUser>) : {}
  ledger[label] = user
  writeFileSync(file, JSON.stringify(ledger, null, 2), { mode: 0o600 })
  return user
}

/** The supplied admin login, for admin acceptance only. Never log or attach it. */
export function adminLogin(): { email: string; password: string; packageId: string } {
  const file = join(process.cwd(), '.local', 'admin-credentials.json')
  if (!existsSync(file)) throw new Error('Admin acceptance needs .local/admin-credentials.json')
  const value = JSON.parse(readFileSync(file, 'utf8')) as { email?: unknown; password?: unknown; package_id?: unknown }
  if (typeof value.email !== 'string' || typeof value.password !== 'string' || typeof value.package_id !== 'string') throw new Error('admin-credentials.json is incomplete')
  return { email: value.email, password: value.password, packageId: value.package_id }
}
