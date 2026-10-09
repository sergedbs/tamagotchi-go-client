import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { MessagesSquare, Plus, Users } from 'lucide-react'
import { z } from 'zod'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { useCommand } from '../../api/useCommand.ts'
import { Button } from '../../components/Button.tsx'
import { TextField } from '../../components/Field.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { LoadProblem } from '../../components/LoadProblem.tsx'
import { useAuthenticated } from '../auth/sessionContext.ts'
import { SocialNav } from '../social/SocialNav.tsx'
import { guildKeys, guildSchema, roleOf, ROLE_LABEL, useGuild, useGuildList, useMembers, useMyInvitations, type Guild } from './api.ts'
import { InvitationRow } from './InvitationRow.tsx'
import { rememberGuild, useGuildHints } from './selectedGuild.ts'
import styles from './Guilds.module.css'

const guildForm = z.object({
  name: z.string().trim().min(3, 'Use at least 3 characters.').max(64, 'Use at most 64 characters.'),
  description: z.string().trim().max(500, 'Use at most 500 characters.'),
})

export default function GuildsPage() {
  const { user } = useAuthenticated()
  const list = useGuildList(user.user_id)
  const invitations = useMyInvitations(user.user_id)
  const pending = invitations.data?.items.filter((item) => item.status === 'PENDING' && item.invited_user_id === user.user_id) ?? []
  const guilds = list.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <main className={styles.page}>
      <SocialNav />
      <header className={styles.header}>
        <h1>Guilds</h1>
        <p className={styles.lead}>Join a guild by invitation, chat with members and start raids together. You can belong to one guild at a time.</p>
      </header>

      <YourGuild userId={user.user_id} />

      {pending.length > 0 && (
        <section className={styles.section} aria-labelledby="invites-heading">
          <h2 id="invites-heading">Invitations for you</h2>
          <ul className={styles.rows}>
            {pending.map((invitation) => (
              <InvitationRow key={invitation.invitation_id} me={user.user_id} invitation={invitation} />
            ))}
          </ul>
        </section>
      )}

      <CreateGuild userId={user.user_id} />

      <section className={styles.section} aria-labelledby="browse-heading">
        <h2 id="browse-heading">Browse guilds</h2>
        {list.isPending ? (
          <p className={styles.muted}>Loading guilds…</p>
        ) : list.isError ? (
          <LoadProblem title="Guilds could not be loaded" message={describeApiError(list.error)} correlationId={isApiError(list.error) ? list.error.correlationId : null} onRetry={() => void list.refetch()} />
        ) : guilds.length === 0 ? (
          <p className={styles.muted}>No guilds exist yet. Create the first one.</p>
        ) : (
          <ul className={styles.guildList}>
            {guilds.map((guild) => (
              <GuildRow key={guild.guild_id} guild={guild} />
            ))}
          </ul>
        )}
        {list.hasNextPage && (
          <Button variant="secondary" busy={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
            Load more guilds
          </Button>
        )}
      </section>
    </main>
  )
}

function GuildRow({ guild }: { guild: Guild }) {
  return (
    <li>
      <Link to={`/guilds/${guild.guild_id}`} className={styles.guildRow}>
        <span className={styles.crest} aria-hidden="true">
          {guild.name.slice(0, 1).toUpperCase()}
        </span>
        <span className={styles.guildText}>
          <span className={styles.rowTitle}>{guild.name}</span>
          {guild.description && <span className={styles.description}>{guild.description}</span>}
        </span>
        <span className={styles.memberCount}>
          <Users size={16} aria-hidden="true" /> {guild.member_count}
        </span>
      </Link>
    </li>
  )
}

/** The remembered guild, shown only after its roster confirms membership. */
function YourGuild({ userId }: { userId: string }) {
  const { selectedGuildId } = useGuildHints(userId)
  const guild = useGuild(userId, selectedGuildId)
  const members = useMembers(userId, selectedGuildId)
  const role = roleOf(members.data, userId)
  if (!selectedGuildId || !guild.data || !members.data || !role) return null
  return (
    <section className={styles.yourGuild} aria-labelledby="your-guild-heading">
      <span className={styles.crestLarge} aria-hidden="true">
        {guild.data.name.slice(0, 1).toUpperCase()}
      </span>
      <div className={styles.guildText}>
        <p className={styles.muted}>Your guild · {ROLE_LABEL[role]}</p>
        <h2 id="your-guild-heading">{guild.data.name}</h2>
      </div>
      <div className={styles.rowActions}>
        <Link to={`/guilds/${guild.data.guild_id}`} className={styles.linkButton}>
          Open
        </Link>
        <Link to={`/guilds/${guild.data.guild_id}/chat`} className={styles.linkButtonPrimary}>
          <MessagesSquare size={18} aria-hidden="true" /> Chat
        </Link>
      </div>
    </section>
  )
}

function CreateGuild({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({})
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const create = useCommand<Guild>({
    onSuccess: (response) => {
      rememberGuild(userId, response.data.guild_id)
      void queryClient.invalidateQueries({ queryKey: guildKeys.list(userId) })
      navigate(`/guilds/${response.data.guild_id}`)
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = guildForm.safeParse(form)
    if (!parsed.success) {
      const next: typeof errors = {}
      for (const issue of parsed.error.issues) next[issue.path[0] as 'name' | 'description'] ??= issue.message
      return setErrors(next)
    }
    setErrors({})
    create.start({ method: 'POST', path: '/guild/v1/guilds', body: parsed.data, idempotent: true, parse: (value) => guildSchema.parse(value), actor: userId })
  }

  if (!open) {
    return (
      <Button variant="secondary" icon={<Plus size={18} aria-hidden="true" />} onClick={() => setOpen(true)} className={styles.createToggle}>
        Create a guild
      </Button>
    )
  }
  return (
    <section className={styles.section} aria-labelledby="create-heading">
      <h2 id="create-heading">Create a guild</h2>
      <form className={styles.form} onSubmit={submit} noValidate>
        <TextField label="Name" value={form.name} maxLength={64} onChange={(event) => {
          setForm({ ...form, name: event.target.value })
          if (create.command && !create.pending) create.reset()
        }} error={errors.name} required />
        <TextField label="Description" value={form.description} maxLength={500} onChange={(event) => {
          setForm({ ...form, description: event.target.value })
          if (create.command && !create.pending) create.reset()
        }} error={errors.description} hint="Optional, up to 500 characters." />
        {create.error && (
          <FormAlert title={create.uncertain ? 'We could not confirm the guild was created.' : 'Guild not created.'} correlationId={isApiError(create.error) ? create.error.correlationId : null}>
            <p>{describeApiError(create.error)}</p>
            {create.uncertain && (
              <Button variant="quiet" onClick={create.retry}>
                Retry same request
              </Button>
            )}
          </FormAlert>
        )}
        <div className={styles.rowActions}>
          <Button variant="quiet" onClick={() => setOpen(false)} disabled={create.pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={create.pending}>
            Create guild
          </Button>
        </div>
      </form>
    </section>
  )
}
