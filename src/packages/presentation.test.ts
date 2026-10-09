import { describe, expect, it } from 'vitest'
import { authoredPackageSchema } from './schema.ts'
import { bundledPackages, presentationByKey, resolvePresentation } from './presentation.ts'
import grove from './authored/grove-companions.json'

const PACKAGE_ID = '01a11d09-508b-7095-80e3-cb2c2db6eca5'

describe('bundled package presentations', () => {
  it('loads every authored package', () => {
    expect([...bundledPackages.keys()].sort()).toEqual(['grove-companions', 'tidewater-companions'])
  })

  it('maps only the explicit package and config version', () => {
    const mapping = { [PACKAGE_ID]: { '2': 'grove-companions' } }
    expect(resolvePresentation(mapping, PACKAGE_ID, 2)?.key).toBe('grove-companions')
    expect(resolvePresentation(mapping, PACKAGE_ID, 1)).toBeNull()
    expect(resolvePresentation(mapping, '01a11d09-0000-7000-8000-000000000000', 2)).toBeNull()
    expect(resolvePresentation({ [PACKAGE_ID]: { '2': 'missing-key' } }, PACKAGE_ID, 2)).toBeNull()
    expect(presentationByKey('grove-companions')?.definition.starter.name).toBe('Mossling')
  })
})

describe('authored package schema', () => {
  const clone = () => structuredClone(grove) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

  it('refuses a care action without presentation', () => {
    const value = clone()
    delete value.presentation.actions.FEED
    expect(authoredPackageSchema.safeParse(value).success).toBe(false)
  })

  it('refuses presentation for an undefined stat', () => {
    const value = clone()
    value.presentation.stats.mood = { label: 'Mood' }
    expect(authoredPackageSchema.safeParse(value).success).toBe(false)
  })

  it('refuses deltas on undefined stats and starter art missing from assets', () => {
    const value = clone()
    value.definition.care_actions[0].deltas[0].stat_key = 'hunger'
    value.definition.starter.sprite_ref = 'lythbound/wolfren/blue'
    const issues = authoredPackageSchema.safeParse(value).error?.issues.map((issue) => issue.message) ?? []
    expect(issues).toEqual(
      expect.arrayContaining(['FEED changes undefined stat hunger', 'starter sprite_ref is missing from assets']),
    )
  })

  it('refuses asset URLs that are not on the supplied public origin', () => {
    const value = clone()
    value.definition.assets[0].url = 'https://example.com/mossling.png'
    expect(authoredPackageSchema.safeParse(value).success).toBe(false)
  })
})
