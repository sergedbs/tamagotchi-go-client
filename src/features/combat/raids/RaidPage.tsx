import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Swords } from 'lucide-react'
import { describeApiError, isApiError } from '../../../api/errors.ts'
import { apiPath } from '../../../api/http.ts'
import { useCommand } from '../../../api/useCommand.ts'
import { isUuid } from '../../../api/uuid.ts'
import { NotFound } from '../../../app/NotFound.tsx'
import { Button } from '../../../components/Button.tsx'
import { ConfirmDialog } from '../../../components/ConfirmDialog.tsx'
import { CreatureArt } from '../../../components/CreatureArt.tsx'
import { FormAlert } from '../../../components/FormAlert.tsx'
import { Habitat } from '../../../components/Habitat.tsx'
import { LoadProblem } from '../../../components/LoadProblem.tsx'
import { TypeBadge } from '../../../components/TypeBadge.tsx'
import { formatInteger } from '../../../lib/format.ts'
import { formatAbsolute } from '../../../lib/time.ts'
import { useNow } from '../../../lib/useNow.ts'
import { useSpriteCatalog } from '../../../packages/spriteCatalog.ts'
import { useAuthenticated } from '../../auth/sessionContext.ts'
import { flattenCollection, useCollection } from '../../creatures/api.ts'
import { useCreatureViews } from '../../creatures/useCreatureViews.ts'
import { roleOf, useMembers } from '../../guilds/api.ts'
import { PersonName } from '../../social/PersonRow.tsx'
import { CombatNav } from '../CombatNav.tsx'
import { StaleNotice } from '../StaleNotice.tsx'
import { Countdown } from '../Countdown.tsx'
import { HpBar } from '../HpBar.tsx'
import { DELIVERY_LABEL, RAID_STATUS_LABEL, raidRewardMeaning } from '../status.ts'
import { raidAttackSchema, raidKeys, useBoss, useLeaderboard, useOccurrence, useRaid, type Raid, type RaidAttack } from './api.ts'
import { bossArtUrl } from './bossArt.ts'
import styles from '../Combat.module.css'

export default function RaidPage() {
  const { id } = useParams()
  if (!isUuid(id)) return <NotFound />
  return <RaidView key={id} raidId={id.toLowerCase()} />
}

function RaidView({ raidId }: { raidId: string }) {
  const { user } = useAuthenticated()
  const raid = useRaid(user.user_id, raidId)
  if (raid.isPending) return <main className={styles.page}><p className={styles.muted}>Loading raid…</p></main>
  // A failed live update keeps the last server state on screen; only a failed first load replaces it.
  if (raid.isError && !raid.data) {
    const status = isApiError(raid.error) ? raid.error.status : null
    return (
      <main className={styles.page}>
        <CombatNav />
        <LoadProblem
          title={status === 403 ? 'This raid belongs to another guild' : status === 404 ? 'This raid is not available' : 'This raid could not be loaded'}
          message={status === 403 ? 'Only members of the raiding guild can open it.' : describeApiError(raid.error)}
          correlationId={isApiError(raid.error) ? raid.error.correlationId : null}
          onRetry={status === 403 || status === 404 ? undefined : () => void raid.refetch()}
        />
      </main>
    )
  }
  return (
    <Encounter
      me={user.user_id}
      raid={raid.data}
      stale={raid.isError ? <StaleNotice error={raid.error} refreshing={raid.isFetching} onRefresh={() => void raid.refetch()} /> : null}
    />
  )
}

function Encounter({ me, raid, stale }: { me: string; raid: Raid; stale: ReactNode }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const catalog = useSpriteCatalog()
  // Extra art/reward data is resolved through the pinned occurrence and boss_version.
  const occurrence = useOccurrence(me, raid.occurrence_id)
  const boss = useBoss(me, occurrence.data?.boss_id, occurrence.data?.boss_version)
  const definition = boss.data?.definition
  const members = useMembers(me, raid.guild_id)
  const isLeader = roleOf(members.data, me) === 'LEADER'
  const leaderboard = useLeaderboard(me, raid.raid_id, raid.version)
  const rows = leaderboard.data?.pages.flatMap((page) => page.items) ?? []
  const joined = rows.some((row) => row.user_id === me)
  const collection = useCollection(me)
  const primary = flattenCollection(collection.data?.pages).primary
  const [primaryView] = useCreatureViews(primary ? [primary] : [])
  const [lastHit, setLastHit] = useState<RaidAttack | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const active = raid.status === 'ACTIVE'
  const now = useNow(1000)

  const attack = useCommand<RaidAttack>({
    onSuccess: (response) => {
      setLastHit(response.data)
      void queryClient.invalidateQueries({ queryKey: raidKeys.raid(me, raid.raid_id) })
    },
  })
  const cancel = useCommand<void>({
    onSuccess: () => {
      setCancelOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['user', me, 'raids'] })
      void queryClient.invalidateQueries({ queryKey: raidKeys.raid(me, raid.raid_id) })
    },
  })
  const nextAttackAt = lastHit?.next_attack_at ?? null
  const cooling = nextAttackAt !== null && Date.parse(nextAttackAt) > now

  return (
    <main className={styles.page}>
      <CombatNav />
      <Link to="/combat/raids" className={styles.back}>
        <ArrowLeft size={18} aria-hidden="true" /> Raids
      </Link>
      {stale}
      <div className={styles.raidLayout}>
        <section className={styles.encounter} aria-labelledby="boss-name">
          <div className={styles.bossStage}>
            <Habitat type={definition?.combat_type ?? null} />
            <div className={styles.bossFigure}>
              <CreatureArt src={bossArtUrl(catalog.data, definition?.sprite_ref)} alt={raid.boss.name} eager />
            </div>
            <span className={styles.raidStatus} data-status={raid.status}>
              {RAID_STATUS_LABEL[raid.status]}
            </span>
          </div>
          <div className={styles.encounterBody}>
            <h1 id="boss-name">{raid.boss.name}</h1>
            <HpBar current={raid.boss.current_hp} max={raid.boss.max_hp} label="Boss" size="large" />
            <div className={styles.affinities}>
              {raid.boss.weaknesses.length > 0 && (
                <p>
                  <span className={styles.muted}>Weak to</span> {raid.boss.weaknesses.map((type) => <TypeBadge key={type} type={type} compact />)}
                </p>
              )}
              {raid.boss.resistances.length > 0 && (
                <p>
                  <span className={styles.muted}>Resists</span> {raid.boss.resistances.map((type) => <TypeBadge key={type} type={type} compact />)}
                </p>
              )}
            </div>
            <p className={styles.muted}>
              {raid.participant_count} of {raid.max_participants} raiders
              {active ? (
                <>
                  {' '}· ends in <Countdown until={raid.expires_at} label="Raid ends in" />
                </>
              ) : (
                raid.ended_at && <> · ended <time title={formatAbsolute(raid.ended_at)}>{new Date(raid.ended_at).toLocaleString()}</time></>
              )}
            </p>

            {active && (
              <div className={styles.raidControls}>
                {primaryView ? (
                  <div className={styles.attacker}>
                    <CreatureArt src={primaryView.artUrl} alt={primaryView.creature.name} size={64} />
                    <span>
                      <strong>{primaryView.creature.name}</strong> attacks for you
                      {!joined && <span className={styles.muted}> · your first accepted attack joins the raid</span>}
                    </span>
                  </div>
                ) : (
                  <p className={styles.muted}>You need a primary creature to attack.</p>
                )}
                <Button
                  variant="primary"
                  className={styles.attack}
                  icon={<Swords size={20} aria-hidden="true" />}
                  disabled={!primary || cooling || attack.pending}
                  busy={attack.pending}
                  onClick={() =>
                    attack.start({
                      method: 'POST',
                      path: apiPath`/raid/v1/raids/${raid.raid_id}/attack`,
                      body: { user_id: me },
                      idempotent: true,
                      parse: (value) => raidAttackSchema.parse(value),
                      actor: me,
                    })
                  }
                >
                  {cooling ? (
                    <>
                      Ready in <Countdown until={nextAttackAt} label="Next attack in" />
                    </>
                  ) : joined ? (
                    'Attack'
                  ) : (
                    'Attack and join'
                  )}
                </Button>
                {lastHit && (
                  <p className={styles.hit} role="status">
                    Hit for <strong className="tabular">{formatInteger(lastHit.damage_dealt)}</strong>. Boss HP left: {formatInteger(lastHit.boss_hp_remaining)}.
                  </p>
                )}
                {attack.error && (
                  <FormAlert title={attack.uncertain ? 'The attack could not be confirmed.' : 'Attack refused.'} correlationId={isApiError(attack.error) ? attack.error.correlationId : null}>
                    <p>
                      {isApiError(attack.error) && attack.error.code === 'creature_engaged'
                        ? 'Your primary is busy in a battle or another raid.'
                        : isApiError(attack.error) && attack.error.retryAfterSeconds
                          ? `${describeApiError(attack.error)} Try again in ${attack.error.retryAfterSeconds} s.`
                          : describeApiError(attack.error)}
                    </p>
                    {attack.uncertain && (
                      <Button variant="quiet" onClick={attack.retry}>
                        Retry same request
                      </Button>
                    )}
                  </FormAlert>
                )}
                {isLeader && (
                  <Button variant="quiet" onClick={() => setCancelOpen(true)}>
                    Cancel raid
                  </Button>
                )}
              </div>
            )}

            {!active && (
              <div className={styles.outcome}>
                <h2 className={styles.outcomeTitle}>Outcome</h2>
                <p>{raidRewardMeaning(raid.status)}</p>
                <dl className={styles.statusList}>
                  <div>
                    <dt>Rewards</dt>
                    <dd data-state={raid.reward_status}>{DELIVERY_LABEL[raid.reward_status]}</dd>
                  </div>
                  {definition && raid.status !== 'CANCELLED' && (
                    <div>
                      <dt>Per raider</dt>
                      <dd>
                        {raid.status === 'COMPLETED'
                          ? `${formatInteger(definition.rewards.xp)} XP, ${formatInteger(definition.rewards.global_currency)} coins`
                          : definition.defeat_rewards
                            ? `${formatInteger(definition.defeat_rewards.xp)} XP, ${formatInteger(definition.defeat_rewards.global_currency)} coins`
                            : 'None for a timeout'}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        </section>

        <aside className={styles.leaderboard} aria-labelledby="leaderboard-heading">
          <h2 id="leaderboard-heading">Leaderboard</h2>
          {leaderboard.isPending ? (
            <p className={styles.muted}>Loading…</p>
          ) : leaderboard.isError ? (
            <FormAlert title="Leaderboard unavailable." correlationId={isApiError(leaderboard.error) ? leaderboard.error.correlationId : null}>
              {describeApiError(leaderboard.error)}{' '}
              <Button variant="quiet" onClick={() => void leaderboard.refetch()}>
                Try again
              </Button>
            </FormAlert>
          ) : rows.length === 0 ? (
            <p className={styles.muted}>No accepted attacks yet.</p>
          ) : (
            <ol className={styles.ranks}>
              {rows.map((row, index) => (
                <li key={row.user_id} data-me={row.user_id === me || undefined}>
                  <span className={styles.rank}>{index + 1}</span>
                  <span className={styles.rankName}>{row.user_id === me ? 'You' : <PersonName userId={row.user_id} />}</span>
                  <span className="tabular">{formatInteger(row.damage_dealt)}</span>
                </li>
              ))}
            </ol>
          )}
          {leaderboard.hasNextPage && (
            <Button variant="quiet" busy={leaderboard.isFetchingNextPage} onClick={() => void leaderboard.fetchNextPage()}>
              Show more
            </Button>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this raid?"
        tone="danger"
        confirmLabel="Cancel raid"
        busy={cancel.pending}
        onClose={() => {
          setCancelOpen(false)
          cancel.reset()
        }}
        onConfirm={() => cancel.start({ method: 'DELETE', path: apiPath`/raid/v1/raids/${raid.raid_id}`, idempotent: false, actor: me })}
        feedback={cancel.error ? <FormAlert title="Not cancelled." correlationId={isApiError(cancel.error) ? cancel.error.correlationId : null}>{describeApiError(cancel.error)}</FormAlert> : null}
      >
        <p>Cancelled raids pay no rewards to anyone, including raiders who already attacked.</p>
      </ConfirmDialog>
      {raid.status === 'CANCELLED' && (
        <Button variant="quiet" onClick={() => navigate('/combat/raids')}>
          Back to raids
        </Button>
      )}
    </main>
  )
}
