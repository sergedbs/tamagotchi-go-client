import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Swords } from 'lucide-react'
import { describeApiError, isApiError } from '../../../api/errors.ts'
import { useCommand } from '../../../api/useCommand.ts'
import { isUuid } from '../../../api/uuid.ts'
import { Button } from '../../../components/Button.tsx'
import { SelectField, TextField } from '../../../components/Field.tsx'
import { FormAlert } from '../../../components/FormAlert.tsx'
import { LoadProblem } from '../../../components/LoadProblem.tsx'
import { formatRelative } from '../../../lib/time.ts'
import { useNow } from '../../../lib/useNow.ts'
import { useAuthenticated } from '../../auth/sessionContext.ts'
import { flattenCollection, useCollection } from '../../creatures/api.ts'
import { useProfile } from '../../players/api.ts'
import { useRelationships } from '../../social/api.ts'
import { PersonName } from '../../social/PersonRow.tsx'
import { CombatNav } from '../CombatNav.tsx'
import { BATTLE_STATUS_LABEL, battleIsTerminal } from '../status.ts'
import { battleKeys, battleSchema, useBattleList, useBoosts, type Battle } from './api.ts'
import { LineupPicker } from './LineupPicker.tsx'
import { lineupBody, lineupErrors, type Lineup } from './lineup.ts'
import styles from '../Combat.module.css'

export default function BattlesPage() {
  const { user } = useAuthenticated()
  const list = useBattleList(user.user_id)
  const now = useNow()
  const battles = list.data?.pages.flatMap((page) => page.items) ?? []
  const active = battles.filter((battle) => !battleIsTerminal(battle.status))
  const past = battles.filter((battle) => battleIsTerminal(battle.status))

  return (
    <main className={styles.page}>
      <CombatNav />
      <header className={styles.header}>
        <h1>Battles</h1>
        <p className={styles.lead}>Challenge another player with two of your creatures. Turns, damage and the result come from the server.</p>
      </header>
      <ChallengeForm userId={user.user_id} />
      <section className={styles.section} aria-labelledby="active-heading">
        <h2 id="active-heading">Active</h2>
        {list.isPending ? (
          <p className={styles.muted}>Loading battles…</p>
        ) : list.isError ? (
          <LoadProblem title="Battles could not be loaded" message={describeApiError(list.error)} correlationId={isApiError(list.error) ? list.error.correlationId : null} onRetry={() => void list.refetch()} />
        ) : active.length === 0 ? (
          <p className={styles.muted}>No active battles.</p>
        ) : (
          <ul className={styles.cards}>
            {active.map((battle) => (
              <BattleRow key={battle.battle_id} battle={battle} me={user.user_id} now={now} />
            ))}
          </ul>
        )}
      </section>
      {past.length > 0 && (
        <section className={styles.section} aria-labelledby="past-heading">
          <h2 id="past-heading">Finished</h2>
          <ul className={styles.cards}>
            {past.map((battle) => (
              <BattleRow key={battle.battle_id} battle={battle} me={user.user_id} now={now} />
            ))}
          </ul>
        </section>
      )}
      {list.hasNextPage && (
        <Button variant="secondary" busy={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
          Load more battles
        </Button>
      )}
    </main>
  )
}

function BattleRow({ battle, me, now }: { battle: Battle; me: string; now: number }) {
  const opponent = battle.challenger_id === me ? battle.opponent_id : battle.challenger_id
  const waitingOnMe = (battle.status === 'PENDING_ACCEPT' && battle.opponent_id === me) || (battle.status === 'ONGOING' && battle.turn_user_id === me)
  const outcome = battle.status === 'COMPLETED' ? (battle.winner_id === me ? 'You won' : battle.loser_id === me ? 'You lost' : 'Finished') : BATTLE_STATUS_LABEL[battle.status]
  return (
    <li>
      <Link to={`/combat/battles/${battle.battle_id}`} className={styles.card} data-attention={waitingOnMe || undefined}>
        <Swords size={20} aria-hidden="true" className={styles.cardIcon} />
        <span className={styles.cardText}>
          <span className={styles.cardTitle}>
            vs <PersonName userId={opponent} />
          </span>
          <span className={styles.muted}>
            {waitingOnMe ? (battle.status === 'PENDING_ACCEPT' ? 'Challenge for you' : 'Your turn') : outcome}
            {!battleIsTerminal(battle.status) && <> · expires {formatRelative(battle.expires_at, now)}</>}
          </span>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </li>
  )
}

function OpponentOption({ userId }: { userId: string }) {
  const profile = useProfile(userId)
  return <option value={userId}>{profile.data?.username ?? 'Loading…'}</option>
}

function ChallengeForm({ userId }: { userId: string }) {
  const [params] = useSearchParams()
  const preset = params.get('opponent')
  const [open, setOpen] = useState(isUuid(preset))
  const [opponent, setOpponent] = useState(isUuid(preset) ? preset : '')
  const [lineup, setLineup] = useState<Lineup>({ primary_id: '', secondary_id: '', boost: false })
  const [errors, setErrors] = useState<{ opponent?: string; primary?: string; secondary?: string }>({})
  const collection = useCollection(userId)
  const boosts = useBoosts(userId)
  const relationships = useRelationships(userId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { primary, secondary } = flattenCollection(collection.data?.pages)
  const creatures = primary ? [primary, ...secondary] : secondary
  const friends = (relationships.data?.items ?? []).filter((item) => item.relationship === 'friend')
  const create = useCommand<Battle>({
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: battleKeys.list(userId) })
      navigate(`/combat/battles/${response.data.battle_id}`)
    },
  })

  if (!open) {
    return (
      <Button variant="primary" icon={<Swords size={18} aria-hidden="true" />} onClick={() => setOpen(true)} className={styles.start}>
        Challenge a player
      </Button>
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = { ...lineupErrors(lineup, creatures.length), ...(isUuid(opponent.trim()) ? {} : { opponent: 'Choose a friend or enter a full player ID.' }) }
    if (opponent.trim() === userId) next.opponent = 'You cannot challenge yourself.'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    create.start({
      method: 'POST',
      path: '/battle/v1/battles',
      body: { opponent_id: opponent.trim().toLowerCase(), ...lineupBody(lineup) },
      idempotent: true,
      parse: (value) => battleSchema.parse(value),
      actor: userId,
    })
  }

  return (
    <section className={styles.panel} aria-labelledby="challenge-heading">
      <h2 id="challenge-heading">Challenge a player</h2>
      <form className={styles.form} onSubmit={submit} noValidate>
        {friends.length > 0 && (
          <SelectField label="Friend" value={friends.some((friend) => friend.user_id === opponent) ? opponent : ''} onChange={(event) => setOpponent(event.target.value)}>
            <option value="">Choose a friend</option>
            {friends.map((friend) => (
              <OpponentOption key={friend.user_id} userId={friend.user_id} />
            ))}
          </SelectField>
        )}
        <TextField label={friends.length > 0 ? 'Or player ID' : 'Opponent player ID'} value={opponent} onChange={(event) => setOpponent(event.target.value)} error={errors.opponent} spellCheck={false} autoComplete="off" />
        {isUuid(opponent.trim()) && (
          <p className={styles.muted}>
            Opponent: <PersonName userId={opponent.trim().toLowerCase()} />
          </p>
        )}
        <LineupPicker creatures={creatures} boosts={boosts.data?.items ?? []} value={lineup} onChange={setLineup} errors={errors} />
        {create.error && (
          <FormAlert title={create.uncertain ? 'We could not confirm the challenge was sent.' : 'Challenge not sent.'} correlationId={isApiError(create.error) ? create.error.correlationId : null}>
            <p>{isApiError(create.error) && create.error.code === 'creature_engaged' ? 'One of these creatures is busy in another battle or raid.' : describeApiError(create.error)}</p>
            {create.uncertain && (
              <Button variant="quiet" onClick={create.retry}>
                Retry same request
              </Button>
            )}
          </FormAlert>
        )}
        <div className={styles.actions}>
          <Button variant="quiet" onClick={() => setOpen(false)} disabled={create.pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={create.pending}>
            Send challenge
          </Button>
        </div>
      </form>
    </section>
  )
}
