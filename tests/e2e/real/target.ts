import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Real-target guard. Real tests run only against an explicitly named test target
 * with explicit confirmation; there is no implicit default.
 */
export function requireRealTarget(): string {
  const target = process.env.E2E_REAL_TARGET
  if (!target || process.env.E2E_CONFIRM_TEST_TARGET !== target) {
    throw new Error(
      'Real tests need E2E_REAL_TARGET=<name> and E2E_CONFIRM_TEST_TARGET=<same name>. ' +
        'They write synthetic data to that target through the Gateway proxy.',
    )
  }
  return target
}

/** The public origin the fixture CLI published package artwork for. */
export function assetOriginOf(target: string): string {
  const targets = JSON.parse(readFileSync(join(process.cwd(), 'fixtures', 'targets.json'), 'utf8')) as Record<string, { public_client_origin?: string }>
  const origin = targets[target]?.public_client_origin
  if (!origin) throw new Error(`fixtures/targets.json has no public_client_origin for ${target}`)
  return new URL(origin).origin
}
