import { Link, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Skull, Users } from 'lucide-react'
import { describeApiError, isApiError } from '../../../api/errors.ts'
import { useCommand } from '../../../api/useCommand.ts'
import { Button } from '../../../components/Button.tsx'
import { CreatureArt } from '../../../components/CreatureArt.tsx'
import { FormAlert } from '../../../components/FormAlert.tsx'
import { LoadProblem } from '../../../components/LoadProblem.tsx'
import { TypeBadge } from '../../../components/TypeBadge.tsx'
import { formatInteger } from '../../../lib/format.ts'
import { formatRelative } from '../../../lib/time.ts'
import { useNow } from '../../../lib/useNow.ts'
import { useSpriteCatalog } from '../../../packages/spriteCatalog.ts'
import { useAuthenticated } from '../../auth/sessionContext.ts'
import { roleOf, useGuild, useMembers } from '../../guilds/api.ts'
import { useGuildHints } from '../../guilds/selectedGuild.ts'
import { CombatNav } from '../CombatNav.tsx'
import { Countdown } from '../Countdown.tsx'
import { occurrenceAvailability, RAID_STATUS_LABEL } from '../status.ts'
import { raidKeys, raidSchema, useBoss, useOccurrences, useRaids, type Occurrence, type Raid } from './api.ts'
import { bossArtUrl } from './bossArt.ts'
import styles from '../Combat.module.css'

export default function RaidsPage() {
  const { user } = useAuthenticated()
  const me = user.user_id
  const now = useNow()
  const { selectedGuildId } = useGuildHints(me)
  const guild = useGuild(me, selectedGuildId)
  const members = useMembers(me, selectedGuildId)
  const role = roleOf(members.data, me)
  const verifiedGuild = role && guild.data ? guild.data : null
  const occurrences = useOccurrences(me)
  const raids = useRaids(me, verifiedGuild?.guild_id ?? null)
  const open = (occurrences.data?.items ?? []).filter((item) => occurrenceAvailability(item, now) === 'available')
  const upcoming = (occurrences.data?.items ?? []).filter((item) => occurrenceAvailability(item, now) === 'upcoming')
  const list = raids.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <main className={styles.page}>
      <CombatNav />
      <header className={styles.header}>
        <h1>Raids</h1>
        <p className={styles.lead}>Guild leaders start a raid on an available boss; members join by attacking with their primary creature.</p>
      </header>

      {verifiedGuild ? (
        <p className={styles.context}>
          Raiding with <Link to={`/guilds/${verifiedGuild.guild_id}`}>{verifiedGuild.name}</Link> as {role === 'LEADER' ? 'leader' : role === 'OFFICER' ? 'officer' : 'member'}.
        </p>
      ) : (
        <p className={styles.context}>
          Open your guild in <Link to="/guilds">Guilds</Link> first to start or follow its raids.
        </p>
      )}

      <section className={styles.section} aria-labelledby="bosses-heading">
        <h2 id="bosses-heading">Available bosses</h2>
        {occurrences.isPending ? (
          <p className={styles.muted}>Loading bosses…</p>
        ) : occurrences.isError ? (
          <LoadProblem title="Bosses could not be loaded" message={describeApiError(occurrences.error)} correlationId={isApiError(occurrences.error) ? occurrences.error.correlationId : null} onRetry={() => void occurrences.refetch()} />
        ) : open.length === 0 ? (
          <p className={styles.muted}>
            No boss is available right now.
            {upcoming.length > 0 && <> The next opens {formatRelative(upcoming.map((item) => item.available_from).sort()[0], now)}.</>}
          </p>
        ) : (
          <ul className={styles.bosses}>
            {open.map((occurrence) => (
              <OccurrenceCard key={occurrence.occurrence_id} me={me} occurrence={occurrence} guildId={role === 'LEADER' ? (verifiedGuild?.guild_id ?? null) : null} />
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="raids-heading">
        <h2 id="raids-heading">{verifiedGuild ? `${verifiedGuild.name} raids` : 'Recent raids'}</h2>
        {raids.isPending ? (
          <p className={styles.muted}>Loading raids…</p>
        ) : raids.isError ? (
          <LoadProblem title="Raids could not be loaded" message={describeApiError(raids.error)} correlationId={isApiError(raids.error) ? raids.error.correlationId : null} onRetry={() => void raids.refetch()} />
        ) : list.length === 0 ? (
          <p className={styles.muted}>No raids yet.</p>
        ) : (
          <ul className={styles.cards}>
            {list.map((raid) => (
              <RaidRow key={raid.raid_id} raid={raid} now={now} />
            ))}
          </ul>
        )}
        {raids.hasNextPage && (
          <Button variant="secondary" busy={raids.isFetchingNextPage} onClick={() => void raids.fetchNextPage()}>
            Load more raids
          </Button>
        )}
      </section>
    </main>
  )
}

function RaidRow({ raid, now }: { raid: Raid; now: number }) {
  return (
    <li>
      <Link to={`/combat/raids/${raid.raid_id}`} className={styles.card} data-attention={raid.status === 'ACTIVE' || undefined}>
        <Skull size={20} aria-hidden="true" className={styles.cardIcon} />
        <span className={styles.cardText}>
          <span className={styles.cardTitle}>{raid.boss.name}</span>
          <span className={styles.muted}>
            {RAID_STATUS_LABEL[raid.status]} · {formatInteger(raid.boss.current_hp)} / {formatInteger(raid.boss.max_hp)} HP · {raid.participant_count}/{raid.max_participants} raiders · started{' '}
            {formatRelative(raid.started_at, now)}
          </span>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>
    </li>
  )
}

function OccurrenceCard({ me, occurrence, guildId }: { me: string; occurrence: Occurrence; guildId: string | null }) {
  const boss = useBoss(me, occurrence.boss_id, occurrence.boss_version)
  const catalog = useSpriteCatalog()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const start = useCommand<Raid>({
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ['user', me, 'raids'] })
      queryClient.setQueryData(raidKeys.raid(me, response.data.raid_id), response.data)
      navigate(`/combat/raids/${response.data.raid_id}`)
    },
  })
  const definition = boss.data?.definition
  return (
    <li className={styles.boss}>
      <div className={styles.bossPortrait}>
        <CreatureArt src={bossArtUrl(catalog.data, definition?.sprite_ref)} alt={definition?.name ?? 'Boss'} size={120} />
      </div>
      <div className={styles.bossText}>
        <h3>{definition?.name ?? (boss.isError ? 'Boss details unavailable' : 'Loading boss…')}</h3>
        {definition && (
          <>
            <p className={styles.bossFacts}>
              <TypeBadge type={definition.combat_type} compact />
              <span>{formatInteger(definition.max_hp)} HP</span>
              <span>
                <Users size={14} aria-hidden="true" /> up to {definition.max_participants}
              </span>
              <span>{Math.round(definition.duration_seconds / 60) || 1} min fight</span>
            </p>
            <p className={styles.muted}>
              Victory: {formatInteger(definition.rewards.xp)} XP, {formatInteger(definition.rewards.global_currency)} coins
              {definition.defeat_rewards ? ` · Timeout: ${formatInteger(definition.defeat_rewards.xp)} XP, ${formatInteger(definition.defeat_rewards.global_currency)} coins` : ' · No timeout reward'}
            </p>
          </>
        )}
        <p className={styles.muted}>
          Closes in <Countdown until={occurrence.available_until} label="Window closes in" />
        </p>
        {guildId ? (
          <Button
            variant="primary"
            busy={start.pending}
            onClick={() =>
              start.start({
                method: 'POST',
                path: '/raid/v1/raids',
                body: { guild_id: guildId, occurrence_id: occurrence.occurrence_id },
                idempotent: true,
                parse: (value) => raidSchema.parse(value),
                actor: me,
              })
            }
          >
            Start raid
          </Button>
        ) : (
          <p className={styles.muted}>Your guild leader starts raids.</p>
        )}
        {start.error && (
          <FormAlert title={start.uncertain ? 'We could not confirm the raid started.' : 'Raid not started.'} correlationId={isApiError(start.error) ? start.error.correlationId : null}>
            <p>{describeApiError(start.error)}</p>
            {start.uncertain && (
              <Button variant="quiet" onClick={start.retry}>
                Retry same request
              </Button>
            )}
          </FormAlert>
        )}
      </div>
    </li>
  )
}
