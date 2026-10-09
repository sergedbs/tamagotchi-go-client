import { describe, expect, it } from 'vitest'
import grove from '../../packages/authored/grove-companions.json'
import { authoredPackageSchema } from '../../packages/schema.ts'
import { checkDraft, draftFromAuthored, formatDraft } from './config.ts'

const authored = authoredPackageSchema.parse(grove)
const base = draftFromAuthored(authored, 'http://localhost:5173')

function withChange(change: (draft: typeof base) => void) {
  const draft = structuredClone(base)
  change(draft)
  return formatDraft(draft)
}

describe('checkDraft', () => {
  it('accepts an authored definition with absolute asset URLs', () => {
    const result = checkDraft(formatDraft(base))
    expect(result.ok).toBe(true)
    expect(base.assets[0]!.url).toBe('http://localhost:5173/assets/creatures/lythbound/wolfren/green.png')
  })

  it('rejects invalid JSON, contract bounds and unknown fields', () => {
    expect(checkDraft('{')).toEqual({ ok: false, errors: ['The draft is not valid JSON.'] })
    const bounded = checkDraft(withChange((draft) => (draft.daily_currency_cap = -1)))
    expect(bounded.ok).toBe(false)
    const extra = checkDraft(withChange((draft) => Object.assign(draft, { presentation: {} })))
    expect(extra.ok).toBe(false)
  })

  it('cross-checks stats, starter values and assets', () => {
    const result = checkDraft(
      withChange((draft) => {
        draft.care_actions[0]!.deltas.push({ stat_key: 'hunger', delta: 1 })
        draft.starter.initial_stats.energy = 500
        draft.starter.initial_stats.temperament = 'grumpy'
        draft.starter.sprite_ref = 'lythbound/missing/ref'
      }),
    )
    expect(result).toEqual({
      ok: false,
      errors: [
        'care_actions.FEED: changes undefined stat hunger.',
        'starter.initial_stats: energy is outside its bounds.',
        'starter.initial_stats: temperament is not an allowed value.',
        'starter.sprite_ref is missing from assets.',
      ],
    })
  })

  it('refuses non-web asset URLs', () => {
    expect(checkDraft(withChange((draft) => (draft.assets[0]!.url = 'javascript:alert(1)'))).ok).toBe(false)
  })
})
