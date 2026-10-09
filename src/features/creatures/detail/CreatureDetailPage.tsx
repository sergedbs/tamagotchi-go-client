import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { describeApiError, isApiError } from '../../../api/errors.ts'
import { isUuid } from '../../../api/uuid.ts'
import { LoadProblem } from '../../../components/LoadProblem.tsx'
import { NotFound } from '../../../app/NotFound.tsx'
import { useAuthenticated } from '../../auth/sessionContext.ts'
import { useCreature } from '../api.ts'
import { CareKeys } from '../home/CareKeys.tsx'
import { CreatureDevice, UNKNOWN_PACKAGE_CARE } from '../home/CreatureHome.tsx'
import { CreatureHomeSkeleton } from '../home/CreatureHomeSkeleton.tsx'
import { useCare } from '../useCare.ts'
import { useCreatureViews } from '../useCreatureViews.ts'
import { careActions, type CreatureView } from '../view.ts'
import { MakePrimary, ReleaseCreature } from './CreatureManage.tsx'
import { HoldersList } from './HoldersList.tsx'
import styles from './CreatureDetail.module.css'

export default function CreatureDetailPage() {
  const { id } = useParams()
  if (!isUuid(id)) return <NotFound />
  return <CreatureDetail key={id} id={id} />
}

function CreatureDetail({ id }: { id: string }) {
  const { user } = useAuthenticated()
  const creature = useCreature(user.user_id, id)
  const views = useCreatureViews(creature.data ? [creature.data.value] : [])
  const view = views[0]

  if (creature.isPending) return <CreatureHomeSkeleton />
  if (creature.isError || !view) {
    const error = creature.error
    const forbidden = isApiError(error) && error.status === 403
    const missing = isApiError(error) && error.status === 404
    return (
      <div className={styles.center}>
        <BackLink />
        <LoadProblem
          title={forbidden ? 'You do not hold this creature' : missing ? 'This creature is not available' : 'This creature could not be loaded'}
          message={forbidden ? 'Only its holders can see its care and stats.' : missing ? 'It may have been released.' : describeApiError(error)}
          correlationId={isApiError(error) ? error.correlationId : null}
          onRetry={forbidden || missing ? undefined : () => void creature.refetch()}
          retrying={creature.isFetching}
        />
      </div>
    )
  }

  return (
    <DetailBody
      userId={user.user_id}
      view={view}
      etag={creature.data?.etag ?? null}
      refreshing={creature.isFetching}
    />
  )
}

function BackLink() {
  return (
    <Link to="/creatures" className={styles.back}>
      <ArrowLeft size={18} aria-hidden="true" /> Creatures
    </Link>
  )
}

function DetailBody({ userId, view, etag, refreshing }: { userId: string; view: CreatureView; etag: string | null; refreshing: boolean }) {
  const care = useCare(userId, view)
  const { creature, presentation } = view
  return (
    <div className={styles.detail}>
      <div className={styles.backRow}>
        <BackLink />
      </div>
      <CreatureDevice view={view} celebrateKey={care.celebrate} />
      <div className={styles.side}>
        <CareKeys
          creatureName={creature.name}
          actions={careActions(presentation)}
          status={care.status}
          unavailableReason={presentation ? null : UNKNOWN_PACKAGE_CARE}
          onCare={care.care}
          onRetry={care.retry}
        />
        <section className={styles.section} aria-labelledby="manage-heading">
          <h2 id="manage-heading">Companion</h2>
          <div className={styles.manage}>
            {creature.role !== 'PRIMARY' && <MakePrimary userId={userId} creature={creature} />}
            <ReleaseCreature userId={userId} creature={creature} etag={etag} refreshing={refreshing} />
          </div>
        </section>
        <HoldersList userId={userId} creatureId={creature.id} name={creature.name} />
      </div>
    </div>
  )
}
