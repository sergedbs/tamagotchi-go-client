import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Crown, MessagesSquare, Send, Users } from 'lucide-react'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { apiPath } from '../../api/http.ts'
import { useCommand } from '../../api/useCommand.ts'
import { isUuid } from '../../api/uuid.ts'
import { NotFound } from '../../app/NotFound.tsx'
import { Button } from '../../components/Button.tsx'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { SelectField, TextField } from '../../components/Field.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { LoadProblem } from '../../components/LoadProblem.tsx'
import { useAuthenticated } from '../auth/sessionContext.ts'
import { useProfile } from '../players/api.ts'
import { useRelationships } from '../social/api.ts'
import { PersonName } from '../social/PersonRow.tsx'
import { SocialNav } from '../social/SocialNav.tsx'
import {
  guildKeys,
  guildSchema,
  invitationSchema,
  membersSchema,
  reconcileGuild,
  roleOf,
  ROLE_LABEL,
  useGuild,
  useMembers,
  useMyInvitations,
  type Guild,
  type Invitation,
  type Member,
  type Members,
} from './api.ts'
import { InvitationRow } from './InvitationRow.tsx'
import { forgetSentInvitation, rememberGuild, rememberSentInvitation, useGuildHints } from './selectedGuild.ts'
import styles from './Guilds.module.css'

type Pending = { kind: 'leave' } | { kind: 'delete' } | { kind: 'kick'; member: Member } | { kind: 'transfer'; member: Member } | null

const ROLE_ORDER: Record<Member['role'], number> = { LEADER: 0, OFFICER: 1, MEMBER: 2 }

export default function GuildPage() {
  const { id } = useParams()
  if (!isUuid(id)) return <NotFound />
  return <GuildView key={id} guildId={id.toLowerCase()} />
}

function GuildView({ guildId }: { guildId: string }) {
  const { user } = useAuthenticated()
  const me = user.user_id
  const guild = useGuild(me, guildId)
  const members = useMembers(me, guildId)
  const invitations = useMyInvitations(me)
  const role = roleOf(members.data, me)

  useEffect(() => {
    if (role) rememberGuild(me, guildId)
  }, [role, me, guildId])

  if (guild.isPending) return <main className={styles.page}><p className={styles.muted}>Loading guild…</p></main>
  if (guild.isError) {
    const missing = isApiError(guild.error) && guild.error.status === 404
    return (
      <main className={styles.page}>
        <SocialNav />
        <LoadProblem
          title={missing ? 'This guild no longer exists' : 'This guild could not be loaded'}
          message={describeApiError(guild.error)}
          correlationId={isApiError(guild.error) ? guild.error.correlationId : null}
          onRetry={missing ? undefined : () => void guild.refetch()}
        />
      </main>
    )
  }
  const invitation = invitations.data?.items.find((item) => item.guild_id === guildId && item.status === 'PENDING' && item.invited_user_id === me)

  return (
    <main className={styles.page}>
      <SocialNav />
      <Link to="/guilds" className={styles.back}>
        <ArrowLeft size={18} aria-hidden="true" /> All guilds
      </Link>
      <header className={styles.guildHeader}>
        <span className={styles.crestLarge} aria-hidden="true">
          {guild.data.name.slice(0, 1).toUpperCase()}
        </span>
        <div className={styles.guildText}>
          <h1>{guild.data.name}</h1>
          {guild.data.description && <p className={styles.lead}>{guild.data.description}</p>}
          <p className={styles.muted}>
            <Users size={14} aria-hidden="true" /> {guild.data.member_count} member{guild.data.member_count === 1 ? '' : 's'}
            {role && <> · You are {ROLE_LABEL[role].toLowerCase()}</>}
          </p>
        </div>
        {role && (
          <Link to={`/guilds/${guildId}/chat`} className={styles.linkButtonPrimary}>
            <MessagesSquare size={18} aria-hidden="true" /> Open chat
          </Link>
        )}
      </header>

      {!role && members.isSuccess && (
        invitation ? (
          <ul className={styles.rows}>
            <InvitationRow me={me} invitation={invitation} />
          </ul>
        ) : (
          <p className={styles.notice}>Membership is by invitation. Ask a member of {guild.data.name} to invite you.</p>
        )
      )}

      {members.isError ? (
        <LoadProblem title="The roster could not be loaded" message={describeApiError(members.error)} correlationId={isApiError(members.error) ? members.error.correlationId : null} onRetry={() => void members.refetch()} />
      ) : members.isPending ? (
        <p className={styles.muted}>Loading roster…</p>
      ) : (
        <Roster me={me} guild={guild.data} members={members.data} role={role} />
      )}
    </main>
  )
}

function Roster({ me, guild, members, role }: { me: string; guild: Guild; members: Members; role: Member['role'] | null }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [pending, setPending] = useState<Pending>(null)
  const done = () => {
    setPending(null)
    reconcileGuild(queryClient, me, guild.guild_id)
  }
  const roleChange = useCommand<Members>({
    onSuccess: (response) => {
      queryClient.setQueryData(guildKeys.members(me, guild.guild_id), response.data)
      done()
    },
    onError: (error) => {
      if (isApiError(error) && (error.code === 'version_conflict' || error.status === 409)) void queryClient.invalidateQueries({ queryKey: guildKeys.members(me, guild.guild_id) })
    },
  })
  const action = useCommand<unknown>({
    onSuccess: (_response, command) => {
      const left = command.method === 'DELETE' && (command.path.endsWith(`/members/${me}`) || command.path === apiPath`/guild/v1/guilds/${guild.guild_id}`)
      done()
      if (left) {
        rememberGuild(me, null)
        navigate('/guilds', { replace: true })
      }
    },
  })
  const leader = role === 'LEADER'
  const sorted = [...members.members].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])

  const confirm = () => {
    if (!pending) return
    if (pending.kind === 'leave') action.start({ method: 'DELETE', path: apiPath`/guild/v1/guilds/${guild.guild_id}/members/${me}`, idempotent: false, actor: me })
    if (pending.kind === 'kick') action.start({ method: 'DELETE', path: apiPath`/guild/v1/guilds/${guild.guild_id}/members/${pending.member.user_id}`, idempotent: false, actor: me })
    if (pending.kind === 'delete') action.start({ method: 'DELETE', path: apiPath`/guild/v1/guilds/${guild.guild_id}`, idempotent: false, actor: me })
    if (pending.kind === 'transfer')
      action.start({
        method: 'POST',
        path: apiPath`/guild/v1/guilds/${guild.guild_id}/leadership`,
        body: { user_id: pending.member.user_id },
        idempotent: true,
        parse: (value) => guildSchema.parse(value),
        actor: me,
      })
  }

  return (
    <>
      <section className={styles.section} aria-labelledby="roster-heading">
        <h2 id="roster-heading">Roster</h2>
        <ul className={styles.roster}>
          {sorted.map((member) => (
            <li key={member.user_id} className={styles.member}>
              <span className={styles.memberName}>
                {member.role === 'LEADER' && <Crown size={16} aria-hidden="true" className={styles.crown} />}
                {member.user_id === me ? 'You' : <Link to={`/players/${member.user_id}`}><PersonName userId={member.user_id} /></Link>}
                <span className={styles.roleTag}>{ROLE_LABEL[member.role]}</span>
              </span>
              {member.user_id !== me && (leader || (role === 'OFFICER' && member.role === 'MEMBER')) && (
                <span className={styles.rowActions}>
                  {leader && member.role !== 'LEADER' && (
                    <Button
                      variant="quiet"
                      busy={roleChange.pending && roleChange.command?.path.includes(member.user_id)}
                      onClick={() =>
                        roleChange.start({
                          method: 'PATCH',
                          path: apiPath`/guild/v1/guilds/${guild.guild_id}/members/${member.user_id}/role`,
                          body: { role: member.role === 'OFFICER' ? 'MEMBER' : 'OFFICER', expected_guild_version: members.version },
                          idempotent: true,
                          parse: (value) => membersSchema.parse(value),
                          actor: me,
                        })
                      }
                    >
                      {member.role === 'OFFICER' ? 'Make member' : 'Make officer'}
                    </Button>
                  )}
                  {leader && member.role !== 'LEADER' && (
                    <Button variant="quiet" onClick={() => setPending({ kind: 'transfer', member })}>
                      Make leader
                    </Button>
                  )}
                  <Button variant="quiet" onClick={() => setPending({ kind: 'kick', member })}>
                    Remove
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
        {roleChange.error && (
          <FormAlert title="Role not changed." correlationId={isApiError(roleChange.error) ? roleChange.error.correlationId : null}>
            {isApiError(roleChange.error) && roleChange.error.status === 409 ? 'The roster changed; it has been reloaded. Review and try again.' : describeApiError(roleChange.error)}
          </FormAlert>
        )}
      </section>

      {(role === 'LEADER' || role === 'OFFICER') && <InviteMembers me={me} guild={guild} members={members} />}

      {role && (
        <section className={styles.section} aria-labelledby="membership-heading">
          <h2 id="membership-heading">Membership</h2>
          <div className={styles.rowActions}>
            <Button variant="secondary" disabled={leader} onClick={() => setPending({ kind: 'leave' })}>
              Leave guild
            </Button>
            {leader && (
              <Button variant="danger" onClick={() => setPending({ kind: 'delete' })}>
                Delete guild
              </Button>
            )}
          </div>
          {leader && <p className={styles.muted}>As leader, transfer leadership before leaving.</p>}
        </section>
      )}

      <ConfirmDialog
        open={pending !== null}
        tone={pending?.kind === 'transfer' ? 'primary' : 'danger'}
        title={
          pending?.kind === 'leave'
            ? `Leave ${guild.name}?`
            : pending?.kind === 'delete'
              ? `Delete ${guild.name}?`
              : pending?.kind === 'kick'
                ? 'Remove this member?'
                : 'Transfer leadership?'
        }
        confirmLabel={pending?.kind === 'leave' ? 'Leave' : pending?.kind === 'delete' ? 'Delete guild' : pending?.kind === 'kick' ? 'Remove' : 'Make leader'}
        busy={action.pending}
        onClose={() => {
          setPending(null)
          action.reset()
        }}
        onConfirm={confirm}
        feedback={
          action.error ? (
            <FormAlert title="Not done." correlationId={isApiError(action.error) ? action.error.correlationId : null}>
              <p>{describeApiError(action.error)}</p>
              {action.uncertain && (
                <Button variant="quiet" onClick={action.retry}>
                  Retry same request
                </Button>
              )}
            </FormAlert>
          ) : null
        }
      >
        {pending?.kind === 'leave' && <p>You lose access to the roster and chat. Rejoining needs a new invitation.</p>}
        {pending?.kind === 'delete' && <p>The guild, its roster and chat are removed for everyone. This cannot be undone.</p>}
        {pending?.kind === 'kick' && (
          <p>
            <PersonName userId={pending.member.user_id} /> leaves the guild and its chat.
          </p>
        )}
        {pending?.kind === 'transfer' && (
          <p>
            <PersonName userId={pending.member.user_id} /> becomes leader. Your role changes as the server decides.
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}

function InviteMembers({ me, guild, members }: { me: string; guild: Guild; members: Members }) {
  const relationships = useRelationships(me)
  const { sentInvitations } = useGuildHints(me)
  const queryClient = useQueryClient()
  const [target, setTarget] = useState('')
  const [error, setError] = useState<string | null>(null)
  const memberIds = new Set(members.members.map((member) => member.user_id))
  const friends = (relationships.data?.items ?? []).filter((item) => item.relationship === 'friend' && !memberIds.has(item.user_id))
  const invite = useCommand<Invitation>({
    onSuccess: (response) => {
      rememberSentInvitation(me, { invitationId: response.data.invitation_id, guildId: guild.guild_id, invitedUserId: response.data.invited_user_id })
      setTarget('')
      reconcileGuild(queryClient, me, guild.guild_id)
    },
  })
  const revoke = useCommand<Invitation>({
    onSuccess: (response) => forgetSentInvitation(me, response.data.invitation_id),
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const id = target.trim().toLowerCase()
    if (!isUuid(id)) return setError('Choose a friend or enter a full player ID.')
    if (memberIds.has(id)) return setError('That player is already a member.')
    setError(null)
    invite.start({ method: 'POST', path: apiPath`/guild/v1/guilds/${guild.guild_id}/invitations`, body: { invited_user_id: id }, idempotent: true, parse: (value) => invitationSchema.parse(value), actor: me })
  }
  const mine = sentInvitations.filter((item) => item.guildId === guild.guild_id)

  return (
    <section className={styles.section} aria-labelledby="invite-heading">
      <h2 id="invite-heading">Invite players</h2>
      <form className={styles.inviteForm} onSubmit={submit} noValidate>
        {friends.length > 0 && (
          <SelectField label="Friend" value={friends.some((friend) => friend.user_id === target) ? target : ''} onChange={(event) => setTarget(event.target.value)}>
            <option value="">Choose a friend</option>
            {friends.map((friend) => (
              <FriendOption key={friend.user_id} userId={friend.user_id} />
            ))}
          </SelectField>
        )}
        <TextField label={friends.length > 0 ? 'Or player ID' : 'Player ID'} value={target} onChange={(event) => setTarget(event.target.value)} error={error} spellCheck={false} autoComplete="off" />
        <Button type="submit" variant="primary" icon={<Send size={18} aria-hidden="true" />} busy={invite.pending}>
          Send invitation
        </Button>
      </form>
      {invite.error && (
        <FormAlert title={invite.uncertain ? 'The invitation could not be confirmed.' : 'Invitation not sent.'} correlationId={isApiError(invite.error) ? invite.error.correlationId : null}>
          <p>{describeApiError(invite.error)}</p>
          {invite.uncertain && (
            <Button variant="quiet" onClick={invite.retry}>
              Retry same request
            </Button>
          )}
        </FormAlert>
      )}
      {mine.length > 0 && (
        <>
          <h3>Sent this session</h3>
          <p className={styles.muted}>The server offers no list of sent invitations, so only ones sent from this tab can be revoked here.</p>
          <ul className={styles.rows}>
            {mine.map((item) => (
              <li key={item.invitationId} className={styles.invitation}>
                <span>
                  <PersonName userId={item.invitedUserId} />
                </span>
                <Button
                  variant="quiet"
                  busy={revoke.pending && revoke.command?.path.includes(item.invitationId)}
                  onClick={() =>
                    revoke.start({
                      method: 'POST',
                      path: apiPath`/guild/v1/guilds/${guild.guild_id}/invitations/${item.invitationId}/revoke`,
                      idempotent: true,
                      parse: (value) => invitationSchema.parse(value),
                      actor: me,
                    })
                  }
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
          {revoke.error && (
            <FormAlert title="Not revoked." correlationId={isApiError(revoke.error) ? revoke.error.correlationId : null}>
              {describeApiError(revoke.error)}
            </FormAlert>
          )}
        </>
      )}
    </section>
  )
}

function FriendOption({ userId }: { userId: string }) {
  const profile = useProfile(userId)
  return <option value={userId}>{profile.data?.username ?? 'Loading…'}</option>
}
