import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Flag, RefreshCw, Swords, Trophy, Zap } from 'lucide-react'
import { describeApiError, isApiError } from '../../../api/errors.ts'
import { apiPath } from '../../../api/http.ts'
import { useCommand } from '../../../api/useCommand.ts'
import { isUuid } from '../../../api/uuid.ts'
import { NotFound } from '../../../app/NotFound.tsx'
import { Button } from '../../../components/Button.tsx'
import { ConfirmDialog } from '../../../components/ConfirmDialog.tsx'
import { CreatureArt } from '../../../components/CreatureArt.tsx'
import { FormAlert } from '../../../components/FormAlert.tsx'
import { LoadProblem } from '../../../components/LoadProblem.tsx'
import { formatInteger } from '../../../lib/format.ts'
import { useAuthenticated } from '../../auth/sessionContext.ts'
import { flattenCollection, useCollection } from '../../creatures/api.ts'
import { useCreatureViews } from '../../creatures/useCreatureViews.ts'
import { PersonName } from '../../social/PersonRow.tsx'
import { CombatNav } from '../CombatNav.tsx'
import { Countdown } from '../Countdown.tsx'
import { HpBar } from '../HpBar.tsx'
import { ACCESS_GRANT_LABEL, BATTLE_STATUS_LABEL, battleIsTerminal, DELIVERY_LABEL, deliveryInFlight } from '../status.ts'
import { battleAttackSchema, battleKeys, battleSchema, useBattle, useBoosts, type Battle, type BattleAttack } from './api.ts'
import { LineupPicker } from './LineupPicker.tsx'
import { lineupBody, lineupErrors, type Lineup } from './lineup.ts'
import styles from '../Combat.module.css'

export default function BattlePage() {
  const { id } = useParams()
  if (!isUuid(id)) return <NotFound />
  return <BattleView key={id} battleId={id.toLowerCase()} />
}

function BattleView({ battleId }: { battleId: string }) {
  const { user } = useAuthenticated()
  const me = user.user_id
  const battle = useBattle(me, battleId)

  if (battle.isPending) return <main className={styles.page}><p className={styles.muted}>Loading battle…</p></main>
  if (battle.isError) {
    const status = isApiError(battle.error) ? battle.error.status : null
    return (
      <main className={styles.page}>
        <CombatNav />
        <LoadProblem
          title={status === 403 ? 'This battle is between other players' : status === 404 ? 'This battle is not available' : 'This battle could not be loaded'}
          message={status === 403 ? 'Only the two players in a battle can open it.' : describeApiError(battle.error)}
          correlationId={isApiError(battle.error) ? battle.error.correlationId : null}
          onRetry={status === 403 || status === 404 ? undefined : () => void battle.refetch()}
        />
      </main>
    )
  }
  return <Arena me={me} battle={battle.data} refreshing={battle.isFetching} onRefresh={() => void battle.refetch()} />
}

function Arena({ me, battle, refreshing, onRefresh }: { me: string; battle: Battle; refreshing: boolean; onRefresh: () => void }) {
  const queryClient = useQueryClient()
  const [lastHit, setLastHit] = useState<BattleAttack | null>(null)
  const [forfeitOpen, setForfeitOpen] = useState(false)
  const opponentId = battle.challenger_id === me ? battle.opponent_id : battle.challenger_id
  const mySide = battle.sides.find((side) => side.user_id === me)
  const theirSide = battle.sides.find((side) => side.user_id === opponentId)
  const terminal = battleIsTerminal(battle.status)
  const myTurn = battle.status === 'ONGOING' && battle.turn_user_id === me
  const outcome = battle.status !== 'COMPLETED' ? null : battle.winner_id === me ? 'won' : battle.loser_id === me ? 'lost' : null
  const update = (next: Battle) => queryClient.setQueryData(battleKeys.battle(me, battle.battle_id), next)

  const respond = useCommand<Battle>({
    onSuccess: (response) => {
      update(response.data)
      void queryClient.invalidateQueries({ queryKey: battleKeys.list(me) })
    },
  })
  const attack = useCommand<BattleAttack>({
    onSuccess: (response) => {
      setLastHit(response.data)
      void queryClient.invalidateQueries({ queryKey: battleKeys.battle(me, battle.battle_id) })
    },
  })
  const forfeit = useCommand<Battle>({
    onSuccess: (response) => {
      setForfeitOpen(false)
      update(response.data)
    },
  })
  const pendingAny = respond.pending || attack.pending || forfeit.pending
  const error = respond.error ?? attack.error ?? null
  const failed = respond.error ? respond : attack.error ? attack : null

  return (
    <main className={styles.page}>
      <CombatNav />
      <Link to="/combat/battles" className={styles.back}>
        <ArrowLeft size={18} aria-hidden="true" /> Battles
      </Link>

      <section className={styles.arena} aria-labelledby="battle-title">
        <header className={styles.arenaHeader}>
          <h1 id="battle-title">
            You vs <PersonName userId={opponentId} />
          </h1>
          <p className={styles.turn} data-mine={myTurn || undefined} data-outcome={outcome ?? undefined} role="status">
            {battle.status === 'ONGOING' ? (
              myTurn ? (
                <>
                  <Zap size={18} aria-hidden="true" /> Your turn · <Countdown until={battle.turn_expires_at} label="Turn time left" />
                </>
              ) : (
                <>
                  Waiting for <PersonName userId={opponentId} /> · <Countdown until={battle.turn_expires_at} label="Their turn time left" />
                </>
              )
            ) : battle.status === 'COMPLETED' ? (
              outcome === 'won' ? (
                <>
                  <Trophy size={22} aria-hidden="true" /> You won
                </>
              ) : outcome === 'lost' ? (
                'You lost'
              ) : (
                'Finished'
              )
            ) : (
              <>
                {BATTLE_STATUS_LABEL[battle.status]}
                {battle.status === 'PENDING_ACCEPT' && (
                  <>
                    {' '}
                    · expires <Countdown until={battle.expires_at} label="Challenge expires in" />
                  </>
                )}
              </>
            )}
          </p>
        </header>

        <div className={styles.sides}>
          <Side label="You" side={mySide} own me={me} highlight={myTurn} />
          <span className={styles.versus} aria-hidden="true">
            VS
          </span>
          <Side label={<PersonName userId={opponentId} />} side={theirSide} me={me} highlight={battle.status === 'ONGOING' && battle.turn_user_id === opponentId} />
        </div>

        {lastHit && (
          <p className={styles.hit} role="status">
            Your attack dealt <strong className="tabular">{formatInteger(lastHit.damage_dealt)}</strong> damage. Opponent HP left: {formatInteger(lastHit.opponent_hp_remaining)}.
          </p>
        )}

        {battle.status === 'PENDING_ACCEPT' && battle.opponent_id === me && (
          <AcceptChallenge me={me} battle={battle} command={respond} />
        )}
        {battle.status === 'PENDING_ACCEPT' && battle.challenger_id === me && <p className={styles.muted}>Your challenge is waiting for the opponent to accept.</p>}
        {battle.status === 'PREPARING' && <p className={styles.muted}>Both lineups are being prepared by the server.</p>}

        {battle.status === 'ONGOING' && (
          <div className={styles.controls}>
            <Button
              variant="primary"
              className={styles.attack}
              icon={<Swords size={20} aria-hidden="true" />}
              disabled={!myTurn || pendingAny}
              busy={attack.pending}
              onClick={() =>
                attack.start({
                  method: 'POST',
                  path: apiPath`/battle/v1/battles/${battle.battle_id}/attack`,
                  body: { user_id: me },
                  idempotent: true,
                  parse: (value) => battleAttackSchema.parse(value),
                  actor: me,
                })
              }
            >
              {myTurn ? 'Attack' : 'Not your turn'}
            </Button>
            <Button variant="quiet" icon={<Flag size={18} aria-hidden="true" />} onClick={() => setForfeitOpen(true)} disabled={pendingAny}>
              Forfeit
            </Button>
          </div>
        )}

        {error && failed && (
          <FormAlert title={failed.uncertain ? 'The action could not be confirmed.' : 'Action refused.'} correlationId={isApiError(error) ? error.correlationId : null}>
            <p>
              {isApiError(error) && error.code === 'challenge_expired'
                ? 'This challenge expired.'
                : isApiError(error) && error.code === 'creature_engaged'
                  ? 'One of the chosen creatures is busy in another battle or raid.'
                  : describeApiError(error)}
            </p>
            {failed.uncertain && (
              <Button variant="quiet" onClick={failed.retry}>
                Retry same request
              </Button>
            )}
          </FormAlert>
        )}
      </section>

      {battle.status === 'COMPLETED' && (
        <section className={styles.delivery} aria-labelledby="delivery-heading">
          <h2 id="delivery-heading">After the battle</h2>
          <p className={styles.muted}>Winning is recorded first; rewards and creature access are delivered separately and can lag behind.</p>
          <dl className={styles.statusList}>
            <div>
              <dt>Rewards</dt>
              <dd data-state={battle.settlement_status}>{DELIVERY_LABEL[battle.settlement_status]}</dd>
            </div>
            <div>
              <dt>Staked creature</dt>
              <dd data-state={battle.access_grant_status}>{ACCESS_GRANT_LABEL[battle.access_grant_status]}</dd>
            </div>
          </dl>
          {(deliveryInFlight(battle.settlement_status) || deliveryInFlight(battle.access_grant_status)) && (
            <Button variant="secondary" icon={<RefreshCw size={16} aria-hidden="true" />} busy={refreshing} onClick={onRefresh}>
              Check status
            </Button>
          )}
        </section>
      )}
      {terminal && battle.status !== 'COMPLETED' && <p className={styles.muted}>This battle ended without a winner.</p>}

      <ConfirmDialog
        open={forfeitOpen}
        title="Forfeit this battle?"
        tone="danger"
        confirmLabel="Forfeit"
        busy={forfeit.pending}
        onClose={() => {
          setForfeitOpen(false)
          forfeit.reset()
        }}
        onConfirm={() =>
          forfeit.start({ method: 'POST', path: apiPath`/battle/v1/battles/${battle.battle_id}/forfeit`, idempotent: true, parse: (value) => battleSchema.parse(value), actor: me })
        }
        feedback={forfeit.error ? <FormAlert title="Not forfeited." correlationId={isApiError(forfeit.error) ? forfeit.error.correlationId : null}>{describeApiError(forfeit.error)}</FormAlert> : null}
      >
        <p>Your opponent wins. The server decides what happens to the staked creature and rewards.</p>
      </ConfirmDialog>
    </main>
  )
}

function Side({ label, side, own = false, me, highlight }: { label: ReactNode; side: Battle['sides'][number] | undefined; own?: boolean; me: string; highlight: boolean }) {
  const collection = useCollection(me)
  const { primary, secondary } = flattenCollection(collection.data?.pages)
  const mine = own && side ? [primary, ...secondary].filter((creature): creature is NonNullable<typeof creature> => !!creature && (creature.id === side.primary_id || creature.id === side.secondary_id)) : []
  const views = useCreatureViews(mine)
  return (
    <div className={styles.side} data-active={highlight || undefined}>
      <p className={styles.sideLabel}>{label}</p>
      <div className={styles.sideArt}>
        {own && views.length > 0
          ? views.map((view) => (
              <figure key={view.creature.id} className={styles.member}>
                <CreatureArt src={view.artUrl} alt="" size={88} />
                <figcaption>{view.creature.name}</figcaption>
              </figure>
            ))
          : [0, 1].map((index) => <CreatureArt key={index} src={null} alt={own ? 'Your creature' : 'Opponent creature'} size={88} />)}
      </div>
      {side ? <HpBar current={side.current_hp} max={side.max_hp} label="Lineup" /> : <p className={styles.muted}>Lineup not chosen yet.</p>}
    </div>
  )
}

function AcceptChallenge({ me, battle, command }: { me: string; battle: Battle; command: ReturnType<typeof useCommand<Battle>> }) {
  const collection = useCollection(me)
  const boosts = useBoosts(me)
  const { primary, secondary } = flattenCollection(collection.data?.pages)
  const creatures = primary ? [primary, ...secondary] : secondary
  const [lineup, setLineup] = useState<Lineup>({ primary_id: '', secondary_id: '', boost: false })
  const [errors, setErrors] = useState<{ primary?: string; secondary?: string }>({})
  return (
    <div className={styles.panel}>
      <h2>Accept the challenge</h2>
      <LineupPicker creatures={creatures} boosts={boosts.data?.items ?? []} value={lineup} onChange={setLineup} errors={errors} />
      <div className={styles.actions}>
        <Button
          variant="secondary"
          disabled={command.pending}
          onClick={() => command.start({ method: 'POST', path: apiPath`/battle/v1/battles/${battle.battle_id}/reject`, idempotent: true, parse: (value) => battleSchema.parse(value), actor: me })}
        >
          Decline
        </Button>
        <Button
          variant="primary"
          busy={command.pending}
          onClick={() => {
            const next = lineupErrors(lineup, creatures.length)
            setErrors(next)
            if (Object.keys(next).length > 0) return
            command.start({
              method: 'POST',
              path: apiPath`/battle/v1/battles/${battle.battle_id}/accept`,
              body: lineupBody(lineup),
              idempotent: true,
              parse: (value) => battleSchema.parse(value),
              actor: me,
            })
          }}
        >
          Accept and fight
        </Button>
      </div>
    </div>
  )
}
