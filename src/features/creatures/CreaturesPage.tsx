import { useEffect, useState } from 'react'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { LoadProblem } from '../../components/LoadProblem.tsx'
import { useAuthenticated } from '../auth/sessionContext.ts'
import { flattenCollection, useCollection } from './api.ts'
import { CollectionShelf } from './home/CollectionShelf.tsx'
import { CreatureHome } from './home/CreatureHome.tsx'
import { CreatureHomeSkeleton } from './home/CreatureHomeSkeleton.tsx'
import { StarterPending } from './home/StarterPending.tsx'
import { useCare } from './useCare.ts'
import { useCreatureViews } from './useCreatureViews.ts'
import type { CreatureView } from './view.ts'
import styles from './CreaturesPage.module.css'

/** Bounded onboarding window for the server-created starter. */
const STARTER_WINDOW_MS = 30_000
const STARTER_POLL_MS = 2_000

const linkTo = (id: string) => `/creatures/${id}`

export default function CreaturesPage() {
  const { user } = useAuthenticated()
  const [waiting, setWaiting] = useState(true)
  const collection = useCollection(user.user_id, { pollMs: false })
  const { primary, secondary } = flattenCollection(collection.data?.pages)
  const empty = collection.isSuccess && !primary && secondary.length === 0

  // Poll only while the starter is expected and the window is open.
  const { refetch } = collection
  useEffect(() => {
    if (!empty || !waiting) return
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refetch()
    }, STARTER_POLL_MS)
    const stop = window.setTimeout(() => setWaiting(false), STARTER_WINDOW_MS)
    return () => {
      window.clearInterval(poll)
      window.clearTimeout(stop)
    }
  }, [empty, waiting, refetch])

  const views = useCreatureViews(primary ? [primary, ...secondary] : secondary)

  if (collection.isPending) return <CreatureHomeSkeleton />
  if (collection.isError) {
    const error = collection.error
    return (
      <main className={styles.center}>
        <LoadProblem
          title="Your creatures could not be loaded"
          message={describeApiError(error)}
          correlationId={isApiError(error) ? error.correlationId : null}
          onRetry={() => void collection.refetch()}
          retrying={collection.isFetching}
        />
      </main>
    )
  }
  if (empty) {
    return (
      <StarterPending
        waiting={waiting}
        checking={collection.isFetching}
        onCheck={() => {
          setWaiting(true)
          void collection.refetch()
        }}
      />
    )
  }

  const shelf = {
    linkTo,
    hasMore: collection.hasNextPage,
    loadingMore: collection.isFetchingNextPage,
    onLoadMore: () => void collection.fetchNextPage(),
  }

  if (!primary) {
    return (
      <main className={styles.noPrimary}>
        <div className={styles.intro}>
          <h1>Choose a primary companion</h1>
          <p>
            You have no primary right now. Open a creature and make it your primary to bring it home and into raids.
          </p>
        </div>
        <CollectionShelf items={views} {...shelf} />
      </main>
    )
  }

  const [primaryView, ...others] = views as [CreatureView, ...CreatureView[]]
  return <PrimaryHome key={primaryView.creature.id} userId={user.user_id} primary={primaryView} others={others} shelf={shelf} />
}

function PrimaryHome({
  userId,
  primary,
  others,
  shelf,
}: {
  userId: string
  primary: CreatureView
  others: CreatureView[]
  shelf: { linkTo: (id: string) => string; hasMore: boolean; loadingMore: boolean; onLoadMore: () => void }
}) {
  const care = useCare(userId, primary)
  return (
    <CreatureHome
      primary={primary}
      others={others}
      care={care.status}
      celebrateKey={care.celebrate}
      onCare={care.care}
      onRetryCare={care.retry}
      {...shelf}
    />
  )
}
