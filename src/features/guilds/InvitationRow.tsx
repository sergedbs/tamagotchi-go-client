import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { apiPath } from '../../api/http.ts'
import { useCommand } from '../../api/useCommand.ts'
import { Button } from '../../components/Button.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { formatRelative } from '../../lib/time.ts'
import { useNow } from '../../lib/useNow.ts'
import { PersonName } from '../social/PersonRow.tsx'
import { invitationSchema, reconcileGuild, useGuild, type Invitation } from './api.ts'
import { rememberGuild } from './selectedGuild.ts'
import styles from './Guilds.module.css'

/** An invitation addressed to me: accept (joins, at most one guild) or decline. */
export function InvitationRow({ me, invitation }: { me: string; invitation: Invitation }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const now = useNow()
  const guild = useGuild(me, invitation.guild_id)
  const command = useCommand<Invitation>({
    onSuccess: (response) => {
      reconcileGuild(queryClient, me, invitation.guild_id)
      if (response.data.status === 'ACCEPTED') {
        rememberGuild(me, invitation.guild_id)
        navigate(`/guilds/${invitation.guild_id}`)
      }
    },
  })
  const answer = (verb: 'accept' | 'decline') =>
    command.start({
      method: 'POST',
      path:
        verb === 'accept'
          ? apiPath`/guild/v1/guilds/${invitation.guild_id}/invitations/${invitation.invitation_id}/accept`
          : apiPath`/guild/v1/guilds/${invitation.guild_id}/invitations/${invitation.invitation_id}/decline`,
      idempotent: true,
      parse: (value) => invitationSchema.parse(value),
      actor: me,
    })

  return (
    <li className={styles.invitation}>
      <div>
        <p className={styles.rowTitle}>{guild.data?.name ?? 'A guild'}</p>
        <p className={styles.muted}>
          Invited by <PersonName userId={invitation.invited_by_user_id} /> · expires {formatRelative(invitation.expires_at, now)}
        </p>
      </div>
      <div className={styles.rowActions}>
        <Button variant="primary" icon={<Check size={18} aria-hidden="true" />} busy={command.pending} onClick={() => answer('accept')}>
          Accept
        </Button>
        <Button variant="secondary" icon={<X size={18} aria-hidden="true" />} disabled={command.pending} onClick={() => answer('decline')}>
          Decline
        </Button>
      </div>
      {command.error && (
        <FormAlert title="Invitation not answered." correlationId={isApiError(command.error) ? command.error.correlationId : null}>
          {describeApiError(command.error)}{' '}
          {command.uncertain && (
            <Button variant="quiet" onClick={command.retry}>
              Retry same request
            </Button>
          )}
        </FormAlert>
      )}
    </li>
  )
}
