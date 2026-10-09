import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { isUuid } from '../../api/uuid.ts'
import { NotFound } from '../../app/NotFound.tsx'
import { CopyValue } from '../../components/CopyValue.tsx'
import { LoadProblem } from '../../components/LoadProblem.tsx'
import { RelationshipBadge } from '../../components/RelationshipBadge.tsx'
import { useAuthenticated } from '../auth/sessionContext.ts'
import { relationshipWith, useRelationships } from '../social/api.ts'
import { RelationshipActions } from '../social/RelationshipActions.tsx'
import { GuildInviteAction } from '../guilds/GuildInviteAction.tsx'
import { useProfile } from './api.ts'
import styles from '../social/Social.module.css'

export default function PlayerPage() {
  const { id } = useParams()
  if (!isUuid(id)) return <NotFound />
  return <Player key={id} id={id.toLowerCase()} />
}

function Player({ id }: { id: string }) {
  const { user } = useAuthenticated()
  const profile = useProfile(id)
  const relationships = useRelationships(user.user_id)
  const self = id === user.user_id

  return (
    <main className={styles.page}>
      <Link to="/social" className={styles.back}>
        <ArrowLeft size={18} aria-hidden="true" /> People
      </Link>
      {profile.isPending ? (
        <p className={styles.muted}>Loading profile…</p>
      ) : profile.isError ? (
        <LoadProblem
          title={isApiError(profile.error) && profile.error.status === 404 ? 'No player with this ID' : 'This profile could not be loaded'}
          message={describeApiError(profile.error)}
          correlationId={isApiError(profile.error) ? profile.error.correlationId : null}
          onRetry={() => void profile.refetch()}
        />
      ) : (
        <article className={styles.profile} aria-labelledby="player-name">
          <div className={styles.profileHead}>
            <span className={styles.monogram} aria-hidden="true">
              {profile.data.username.slice(0, 1).toUpperCase()}
            </span>
            <div className={styles.profileText}>
              <h1 id="player-name">{profile.data.username}</h1>
              {self ? (
                <p className={styles.muted}>This is you.</p>
              ) : (
                relationships.isSuccess && <RelationshipBadge kind={relationshipWith(relationships.data.items, id)} />
              )}
            </div>
          </div>
          <p className={styles.idLine}>
            <CopyValue value={id} label="Player ID" size="body" />
          </p>
          {!self && (
            <>
              <RelationshipActions me={user.user_id} otherId={id} name={profile.data.username} />
              <GuildInviteAction me={user.user_id} otherId={id} name={profile.data.username} />
              <Link to={`/combat/battles?opponent=${id}`} className={styles.challenge}>
                Challenge to a battle
              </Link>
            </>
          )}
        </article>
      )}
    </main>
  )
}
