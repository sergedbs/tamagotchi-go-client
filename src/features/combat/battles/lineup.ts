export interface Lineup {
  primary_id: string
  secondary_id: string
  boost: boolean
}

export function lineupErrors(value: Lineup, creatureCount: number) {
  if (creatureCount < 2) return { primary: 'Battles need two of your creatures. Join another package to get a second starter.' }
  const errors: { primary?: string; secondary?: string } = {}
  if (!value.primary_id) errors.primary = 'Choose a lead creature.'
  if (!value.secondary_id) errors.secondary = 'Choose a second creature.'
  if (value.primary_id && value.primary_id === value.secondary_id) errors.secondary = 'Choose two different creatures.'
  return errors
}

export function lineupBody(value: Lineup) {
  return { primary_id: value.primary_id, secondary_id: value.secondary_id, boost_ids: value.boost ? ['ATTACK_10'] : [] }
}
