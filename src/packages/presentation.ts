import type { ClientConfig } from '../app/config.ts'
import { authoredPackageSchema, type AuthoredPackage } from './schema.ts'

const modules = import.meta.glob<unknown>('./authored/*.json', { eager: true, import: 'default' })

/** Bundled, validated presentations keyed by authored package key. */
export const bundledPackages: ReadonlyMap<string, AuthoredPackage> = new Map(
  Object.entries(modules).map(([path, raw]) => {
    const parsed = authoredPackageSchema.parse(raw)
    if (!path.endsWith(`/${parsed.key}.json`)) throw new Error(`${path} must be named ${parsed.key}.json`)
    return [parsed.key, parsed]
  }),
)

export function presentationByKey(key: string): AuthoredPackage | null {
  return bundledPackages.get(key) ?? null
}

/**
 * Explicit package_id + config_version mapping from public config. An unmapped
 * version is unknown: never render another version's care controls.
 */
export function resolvePresentation(
  mapping: ClientConfig['package_presentations'],
  packageId: string,
  configVersion: number,
): AuthoredPackage | null {
  const key = mapping[packageId]?.[String(configVersion)]
  return key ? presentationByKey(key) : null
}
