import { SelectField } from '../../../components/Field.tsx'
import type { Tamagotchi } from '../../creatures/dto.ts'
import type { Boost } from './api.ts'
import type { Lineup } from './lineup.ts'
import styles from '../Combat.module.css'

/** Two distinct held creatures, plus an optional boost when one is available. */
export function LineupPicker({ creatures, boosts, value, onChange, errors }: { creatures: Tamagotchi[]; boosts: Boost[]; value: Lineup; onChange: (next: Lineup) => void; errors?: { primary?: string; secondary?: string } }) {
  const boost = boosts.find((item) => item.boost_id === 'ATTACK_10' && item.charges > 0)
  const option = (creature: Tamagotchi) => (
    <option key={creature.id} value={creature.id}>
      {creature.name} · level {creature.level}
    </option>
  )
  return (
    <div className={styles.lineup}>
      <SelectField label="Lead creature" value={value.primary_id} error={errors?.primary} onChange={(event) => onChange({ ...value, primary_id: event.target.value })}>
        <option value="">Choose a creature</option>
        {creatures.map(option)}
      </SelectField>
      <SelectField label="Second creature" value={value.secondary_id} error={errors?.secondary} onChange={(event) => onChange({ ...value, secondary_id: event.target.value })}>
        <option value="">Choose a creature</option>
        {creatures.filter((creature) => creature.id !== value.primary_id).map(option)}
      </SelectField>
      {boost && (
        <label className={styles.check}>
          <input type="checkbox" checked={value.boost} onChange={(event) => onChange({ ...value, boost: event.target.checked })} />
          Use an attack boost (+{boost.attack_bps / 100}% attack, {boost.charges} left)
        </label>
      )}
    </div>
  )
}
