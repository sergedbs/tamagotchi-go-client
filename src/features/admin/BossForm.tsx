import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../../components/Button.tsx'
import { CreatureArt } from '../../components/CreatureArt.tsx'
import { SelectField, TextAreaField, TextField } from '../../components/Field.tsx'
import { typeLabel } from '../../components/typeLabel.ts'
import { useSpriteCatalog } from '../../packages/spriteCatalog.ts'
import { COMBAT_TYPES, type CombatType } from '../creatures/dto.ts'
import { bossArtUrl } from '../combat/raids/bossArt.ts'
import { bossErrors, bossInputSchema, type BossInput } from './bossInput.ts'
import styles from './Admin.module.css'

type Draft = Omit<BossInput, 'max_hp' | 'defense' | 'duration_seconds' | 'max_participants' | 'rewards' | 'defeat_rewards'> & {
  max_hp: string
  defense: string
  duration_seconds: string
  max_participants: string
  reward_xp: string
  reward_currency: string
  defeat: boolean
  defeat_xp: string
  defeat_currency: string
}

const toDraft = (boss: BossInput): Draft => ({
  ...boss,
  max_hp: String(boss.max_hp),
  defense: String(boss.defense),
  duration_seconds: String(boss.duration_seconds),
  max_participants: String(boss.max_participants),
  reward_xp: String(boss.rewards.xp),
  reward_currency: String(boss.rewards.global_currency),
  defeat: boss.defeat_rewards !== null,
  defeat_xp: String(boss.defeat_rewards?.xp ?? 0),
  defeat_currency: String(boss.defeat_rewards?.global_currency ?? 0),
})

const num = (value: string) => (value.trim() === '' ? Number.NaN : Number(value))

function fromDraft(draft: Draft): unknown {
  return {
    name: draft.name.trim(),
    description: draft.description,
    sprite_ref: draft.sprite_ref.trim(),
    combat_type: draft.combat_type,
    max_hp: num(draft.max_hp),
    defense: num(draft.defense),
    weaknesses: draft.weaknesses,
    resistances: draft.resistances,
    special_properties: {},
    duration_seconds: num(draft.duration_seconds),
    max_participants: num(draft.max_participants),
    rewards: { xp: num(draft.reward_xp), global_currency: num(draft.reward_currency) },
    defeat_rewards: draft.defeat ? { xp: num(draft.defeat_xp), global_currency: num(draft.defeat_currency) } : null,
  }
}

/** Full BossInput form with contract bounds; the parent sends it (create or versioned replace). */
export function BossForm({ initial, submitLabel, busy, feedback, onSubmit }: { initial: BossInput; submitLabel: string; busy: boolean; feedback: ReactNode; onSubmit: (boss: BossInput) => void }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const catalog = useSpriteCatalog()
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const toggle = (key: 'weaknesses' | 'resistances', type: CombatType, on: boolean) =>
    set(key, on ? [...draft[key], type] : draft[key].filter((item) => item !== type))
  const art = bossArtUrl(catalog.data, draft.sprite_ref.trim())

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = fromDraft(draft)
    const next = bossErrors(value)
    setErrors(next)
    if (Object.keys(next).length === 0) onSubmit(bossInputSchema.parse(value))
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <div className={styles.bossHead}>
        <div className={styles.preview}>
          <CreatureArt src={art} alt={draft.name || 'Boss preview'} size={120} />
          <p className={styles.muted}>{art ? 'Catalog artwork' : 'No catalog artwork for this sprite_ref; players see the fallback.'}</p>
        </div>
        <div className={styles.form}>
          <TextField label="Name" value={draft.name} error={errors.name} maxLength={64} onChange={(event) => set('name', event.target.value)} />
          <TextField label="Sprite reference" hint="A Lythbound catalog ref such as lythbound/gryfon/spicy." value={draft.sprite_ref} error={errors.sprite_ref} maxLength={512} onChange={(event) => set('sprite_ref', event.target.value)} />
        </div>
      </div>
      <TextAreaField label="Description" value={draft.description} error={errors.description} maxLength={1000} rows={2} onChange={(event) => set('description', event.target.value)} />
      <div className={styles.grid}>
        <SelectField label="Combat type" value={draft.combat_type} onChange={(event) => set('combat_type', event.target.value as CombatType)}>
          {COMBAT_TYPES.map((type) => (
            <option key={type} value={type}>
              {typeLabel(type)}
            </option>
          ))}
        </SelectField>
        <TextField label="Max HP" inputMode="numeric" value={draft.max_hp} error={errors.max_hp} hint="1 to 1,000,000,000" onChange={(event) => set('max_hp', event.target.value)} />
        <TextField label="Defense" inputMode="numeric" value={draft.defense} error={errors.defense} hint="0 to 1,000,000" onChange={(event) => set('defense', event.target.value)} />
        <TextField label="Duration (seconds)" inputMode="numeric" value={draft.duration_seconds} error={errors.duration_seconds} hint="1 to 3600" onChange={(event) => set('duration_seconds', event.target.value)} />
        <TextField label="Max raiders" inputMode="numeric" value={draft.max_participants} error={errors.max_participants} hint="1 to 100" onChange={(event) => set('max_participants', event.target.value)} />
      </div>
      <TypeChecks legend="Weak to" value={draft.weaknesses} error={errors.weaknesses} onToggle={(type, on) => toggle('weaknesses', type, on)} />
      <TypeChecks legend="Resists" value={draft.resistances} error={errors.resistances} onToggle={(type, on) => toggle('resistances', type, on)} />
      <fieldset className={styles.fieldset}>
        <legend>Victory rewards per raider</legend>
        <div className={styles.grid}>
          <TextField label="XP" inputMode="numeric" value={draft.reward_xp} error={errors['rewards.xp']} onChange={(event) => set('reward_xp', event.target.value)} />
          <TextField label="Coins" inputMode="numeric" value={draft.reward_currency} error={errors['rewards.global_currency']} onChange={(event) => set('reward_currency', event.target.value)} />
        </div>
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend>Timeout rewards per raider</legend>
        <label className={styles.check}>
          <input type="checkbox" checked={draft.defeat} onChange={(event) => set('defeat', event.target.checked)} /> Pay something when time runs out
        </label>
        {draft.defeat && (
          <div className={styles.grid}>
            <TextField label="Timeout XP" inputMode="numeric" value={draft.defeat_xp} error={errors['defeat_rewards.xp']} onChange={(event) => set('defeat_xp', event.target.value)} />
            <TextField label="Timeout coins" inputMode="numeric" value={draft.defeat_currency} error={errors['defeat_rewards.global_currency']} onChange={(event) => set('defeat_currency', event.target.value)} />
          </div>
        )}
      </fieldset>
      {feedback}
      <Button type="submit" variant="primary" busy={busy} className={styles.submit}>
        {submitLabel}
      </Button>
    </form>
  )
}

function TypeChecks({ legend, value, error, onToggle }: { legend: string; value: CombatType[]; error?: string; onToggle: (type: CombatType, on: boolean) => void }) {
  return (
    <fieldset className={styles.fieldset}>
      <legend>{legend}</legend>
      <div className={styles.typeChecks}>
        {COMBAT_TYPES.map((type) => (
          <label key={type} className={styles.check}>
            <input type="checkbox" checked={value.includes(type)} onChange={(event) => onToggle(type, event.target.checked)} />
            {typeLabel(type)}
          </label>
        ))}
      </div>
      {error && <p className={styles.fieldError}>{error}</p>}
    </fieldset>
  )
}
