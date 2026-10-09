import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { isApiError } from '../../api/errors.ts'
import { useCommand } from '../../api/useCommand.ts'
import { Button } from '../../components/Button.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { LoadProblem } from '../../components/LoadProblem.tsx'
import { TypeBadge } from '../../components/TypeBadge.tsx'
import { formatInteger } from '../../lib/format.ts'
import { useAuthenticated } from '../auth/sessionContext.ts'
import { bossSchema, type Boss } from '../combat/raids/api.ts'
import { AdminNav } from './AdminNav.tsx'
import { adminKeys, useAdminBosses } from './api.ts'
import { BossForm } from './BossForm.tsx'
import { EMPTY_BOSS } from './bossInput.ts'
import { adminFailure } from './denied.ts'
import styles from './Admin.module.css'

export default function BossesAdminPage() {
  const { user } = useAuthenticated()
  const bosses = useAdminBosses(user.user_id)
  const items = bosses.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <main className={styles.page}>
      <AdminNav />
      <header className={styles.header}>
        <h1>Bosses</h1>
        <p className={styles.lead}>Each save creates a new boss version. Occurrences and raids keep the version they pinned.</p>
      </header>
      <CreateBoss userId={user.user_id} />
      {bosses.isPending ? (
        <p className={styles.muted}>Loading bosses…</p>
      ) : bosses.isError ? (
        <LoadProblem
          title={isApiError(bosses.error) && bosses.error.status === 403 ? 'Boss administration needs the admin role' : 'Bosses could not be loaded'}
          message={adminFailure(bosses.error)}
          correlationId={isApiError(bosses.error) ? bosses.error.correlationId : null}
          onRetry={isApiError(bosses.error) && bosses.error.status === 403 ? undefined : () => void bosses.refetch()}
        />
      ) : items.length === 0 ? (
        <p className={styles.muted}>No bosses yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="visually-hidden">Bosses</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Type</th>
                <th scope="col">HP</th>
                <th scope="col">Duration</th>
                <th scope="col">Raiders</th>
                <th scope="col">Version</th>
              </tr>
            </thead>
            <tbody>
              {items.map((boss) => (
                <BossRow key={boss.boss_id} boss={boss} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {bosses.hasNextPage && (
        <Button variant="secondary" busy={bosses.isFetchingNextPage} onClick={() => void bosses.fetchNextPage()}>
          Load more bosses
        </Button>
      )}
    </main>
  )
}

function BossRow({ boss }: { boss: Boss }) {
  const definition = boss.definition
  return (
    <tr>
      <th scope="row">
        <Link to={`/admin/bosses/${boss.boss_id}`}>{definition.name}</Link>
      </th>
      <td>
        <TypeBadge type={definition.combat_type} compact />
      </td>
      <td className="tabular">{formatInteger(definition.max_hp)}</td>
      <td className="tabular">{Math.round(definition.duration_seconds / 60) || 1} min</td>
      <td className="tabular">{definition.max_participants}</td>
      <td className="tabular">v{boss.config_version}</td>
    </tr>
  )
}

function CreateBoss({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const create = useCommand<Boss>({
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.bosses(userId) })
      navigate(`/admin/bosses/${response.data.boss_id}`)
    },
  })
  if (!open) {
    return (
      <Button variant="secondary" icon={<Plus size={18} aria-hidden="true" />} onClick={() => setOpen(true)} className={styles.start}>
        Create a boss
      </Button>
    )
  }
  return (
    <section className={styles.panel} aria-labelledby="create-boss-heading">
      <h2 id="create-boss-heading">Create a boss</h2>
      <BossForm
        initial={EMPTY_BOSS}
        submitLabel="Create boss"
        busy={create.pending}
        onSubmit={(boss) => create.start({ method: 'POST', path: '/registry/v1/bosses', body: boss, idempotent: true, parse: (value) => bossSchema.parse(value), actor: userId })}
        feedback={
          create.error ? (
            <FormAlert title={create.uncertain ? 'We could not confirm the boss was created.' : 'Boss not created.'} correlationId={isApiError(create.error) ? create.error.correlationId : null}>
              <p>{adminFailure(create.error)}</p>
              {create.uncertain && (
                <Button variant="quiet" onClick={create.retry}>
                  Retry same request
                </Button>
              )}
            </FormAlert>
          ) : null
        }
      />
      <Button variant="quiet" onClick={() => setOpen(false)} disabled={create.pending}>
        Cancel
      </Button>
    </section>
  )
}
