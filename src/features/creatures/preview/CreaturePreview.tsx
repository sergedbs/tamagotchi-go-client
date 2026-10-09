/**
 * DESIGN PREVIEW (dev builds only). Renders the creature home from explicit sample
 * data so the visual system can be reviewed without a server. Not a runtime fallback.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { LoadProblem } from '../../../components/LoadProblem.tsx'
import { presentationByKey } from '../../../packages/presentation.ts'
import { findCatalogSprite, useSpriteCatalog } from '../../../packages/spriteCatalog.ts'
import { CreatureHome } from '../home/CreatureHome.tsx'
import { CreatureHomeSkeleton } from '../home/CreatureHomeSkeleton.tsx'
import { careChanges, type CareStatus, type CreatureView } from '../view.ts'
import { PREVIEW_CORRELATION_ID, PREVIEW_STATES, previewOthers, previewPrimary, type PreviewState } from './previewData.ts'
import styles from './CreaturePreview.module.css'

function initialCare(state: PreviewState): CareStatus {
  switch (state) {
    case 'care-pending':
      return { kind: 'pending', action: 'PLAY' }
    case 'care-done':
      return {
        kind: 'done',
        action: 'FEED',
        changes: [
          { label: 'XP', before: '1,238', after: '1,240' },
          { label: 'Energy', before: '44', after: '54' },
        ],
      }
    case 'cooldown':
      return { kind: 'cooldown', action: 'FEED', retryAfterSeconds: null }
    case 'care-error':
      return {
        kind: 'failed',
        action: 'PLAY',
        message: 'The server did not answer in time, so the action may or may not have been applied.',
        correlationId: PREVIEW_CORRELATION_ID,
        uncertain: true,
      }
    default:
      return { kind: 'idle' }
  }
}

export default function CreaturePreview() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const requested = params.get('state')
  const state: PreviewState = PREVIEW_STATES.includes(requested as PreviewState) ? (requested as PreviewState) : 'default'
  const catalog = useSpriteCatalog()
  const art = (ref: string) => findCatalogSprite(catalog.data, ref)?.url ?? null

  const primary = useMemo<CreatureView>(() => {
    const unknown = state === 'unknown-package'
    const creature = {
      ...previewPrimary,
      name: state === 'long-name' ? 'Bartholomew of the Very Long Afternoon Moss Hollow' : previewPrimary.name,
      package_stats: unknown ? { vigor: 31, mood_word: 'sleepy', polished: true } : previewPrimary.package_stats,
    }
    return {
      creature,
      artUrl: unknown ? null : art(creature.sprite_ref),
      presentation: unknown ? null : presentationByKey('grove-companions'),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, catalog.data])

  const others = useMemo<CreatureView[]>(
    () =>
      state === 'empty'
        ? []
        : previewOthers.map(({ creature, presentationKey }) => ({
            creature,
            artUrl: art(creature.sprite_ref),
            presentation: presentationKey ? presentationByKey(presentationKey) : null,
          })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, catalog.data],
  )

  return (
    <>
      <aside className={styles.banner} aria-label="Design preview">
        <p>
          <strong>Design preview</strong> · sample data, not connected
        </p>
        <label className={styles.picker}>
          <span className="visually-hidden">Preview state</span>
          <select value={state} onChange={(event) => navigate(`?state=${event.target.value}`)}>
            {PREVIEW_STATES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </aside>
      {state === 'loading' || (catalog.isPending && state !== 'unavailable') ? (
        <CreatureHomeSkeleton />
      ) : state === 'unavailable' ? (
        <div className={styles.center}>
          <LoadProblem
            title="Your creatures could not be loaded"
            message="Tamagotchi Go is not reachable right now. Nothing was changed; try again in a moment."
            correlationId={PREVIEW_CORRELATION_ID}
            onRetry={() => undefined}
          />
        </div>
      ) : (
        <PreviewHome key={state} state={state} primary={primary} others={others} />
      )}
    </>
  )
}

function PreviewHome({ state, primary, others }: { state: PreviewState; primary: CreatureView; others: CreatureView[] }) {
  const [care, setCare] = useState<CareStatus>(() => initialCare(state))
  const [view, setView] = useState(primary)
  const [celebrate, setCelebrate] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  // Simulated round trip, preview only: applies the authored rule locally.
  const simulateCare = (action: string) => {
    setCare({ kind: 'pending', action })
    timer.current = window.setTimeout(() => {
      const rule = view.presentation?.definition.care_actions.find((candidate) => candidate.action === action)
      if (!rule || !view.presentation) return
      const stats = { ...view.creature.package_stats }
      for (const delta of rule.deltas) {
        const def = view.presentation.definition.stats.find((stat) => stat.key === delta.stat_key)
        const current = stats[delta.stat_key]
        if (typeof current === 'number' && def) {
          stats[delta.stat_key] = Math.min(def.maximum ?? Infinity, Math.max(def.minimum ?? -Infinity, current + delta.delta))
        }
      }
      const next = { ...view.creature, xp: view.creature.xp + rule.xp, package_stats: stats }
      setCare({ kind: 'done', action, changes: careChanges(view, next) })
      setView({ ...view, creature: next })
      setCelebrate((count) => count + 1)
    }, 700)
  }

  return (
    <CreatureHome
      primary={view}
      others={others}
      care={care}
      celebrateKey={celebrate}
      onCare={simulateCare}
      onRetryCare={() => simulateCare(care.kind === 'failed' ? care.action : 'FEED')}
      linkTo={() => '?state=default'}
    />
  )
}
