import { useQueryClient } from '@tanstack/react-query'
import { Send } from 'lucide-react'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { apiPath } from '../../api/http.ts'
import { useCommand } from '../../api/useCommand.ts'
import { Button } from '../../components/Button.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { guildKeys, invitationSchema, roleOf, useGuild, useMembers, type Invitation } from './api.ts'
import { rememberSentInvitation, useGuildHints } from './selectedGuild.ts'
import styles from './Guilds.module.css'

/** Invite from a profile, using the verified last-selected guild as context. */
export function GuildInviteAction({ me, otherId, name }: { me: string; otherId: string; name: string }) {
  const { selectedGuildId } = useGuildHints(me)
  const guild = useGuild(me, selectedGuildId)
  const members = useMembers(me, selectedGuildId)
  const queryClient = useQueryClient()
  const invite = useCommand<Invitation>({
    onSuccess: (response) => {
      rememberSentInvitation(me, { invitationId: response.data.invitation_id, guildId: response.data.guild_id, invitedUserId: otherId })
      void queryClient.invalidateQueries({ queryKey: guildKeys.members(me, response.data.guild_id) })
    },
  })

  const role = roleOf(members.data, me)
  if (!selectedGuildId || !guild.data || !members.data || (role !== 'LEADER' && role !== 'OFFICER')) return null
  if (members.data.members.some((member) => member.user_id === otherId)) {
    return <p className={styles.muted}>{name} is already in {guild.data.name}.</p>
  }

  return (
    <div className={styles.inviteAction}>
      {invite.data ? (
        <FormAlert title={`Invitation to ${guild.data.name} sent.`} tone="info">
          Manage it from the guild page while this session lasts.
        </FormAlert>
      ) : (
        <Button
          variant="secondary"
          icon={<Send size={18} aria-hidden="true" />}
          busy={invite.pending}
          onClick={() =>
            invite.start({
              method: 'POST',
              path: apiPath`/guild/v1/guilds/${selectedGuildId}/invitations`,
              body: { invited_user_id: otherId },
              idempotent: true,
              parse: (value) => invitationSchema.parse(value),
              actor: me,
            })
          }
        >
          Invite to {guild.data.name}
        </Button>
      )}
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
    </div>
  )
}
