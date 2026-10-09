import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { isApiError } from '../../api/errors.ts'
import { apiPath } from '../../api/http.ts'
import { useCommand } from '../../api/useCommand.ts'
import { isUuid } from '../../api/uuid.ts'
import { NotFound } from '../../app/NotFound.tsx'
import { Button } from '../../components/Button.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { LoadProblem } from '../../components/LoadProblem.tsx'
import { useAuthenticated } from '../auth/sessionContext.ts'
import { bossSchema, type Boss } from '../combat/raids/api.ts'
import type { WithEtag } from '../creatures/api.ts'
import { AdminNav } from './AdminNav.tsx'
import { adminKeys, useAdminBoss } from './api.ts'
import { BossForm } from './BossForm.tsx'
import { bossInputFrom } from './bossInput.ts'
import { adminFailure } from './denied.ts'
import styles from './Admin.module.css'

export default function BossAdminPage() {
  const { id } = useParams()
  if (!isUuid(id)) return <NotFound />
  return <BossAdmin key={id} bossId={id.toLowerCase()} />
}

function BossAdmin({ bossId }: { bossId: string }) {
  const { user } = useAuthenticated()
  const me = user.user_id
  const boss = useAdminBoss(me, bossId)
  const queryClient = useQueryClient()
  const [formKey, setFormKey] = useState(0)
  const save = useCommand<Boss>({
    onSuccess: (response) => {
      queryClient.setQueryData<WithEtag<Boss>>(adminKeys.boss(me, bossId), { value: response.data, etag: response.etag })
      void queryClient.invalidateQueries({ queryKey: adminKeys.bosses(me) })
    },
  })
  const conflict = isApiError(save.error) && save.error.status === 412

  return (
    <main className={styles.page}>
      <AdminNav />
      <Link to="/admin/bosses" className={styles.back}>
        <ArrowLeft size={18} aria-hidden="true" /> Bosses
      </Link>
      {boss.isPending ? (
        <p className={styles.muted}>Loading boss…</p>
      ) : boss.isError ? (
        <LoadProblem title="This boss could not be loaded" message={adminFailure(boss.error)} correlationId={isApiError(boss.error) ? boss.error.correlationId : null} onRetry={() => void boss.refetch()} />
      ) : (
        <>
          <header className={styles.header}>
            <h1>{boss.data.value.definition.name}</h1>
            <p className={styles.muted}>
              Version {boss.data.value.config_version}. Saving replaces the whole definition as version {boss.data.value.config_version + 1}; occurrences and raids keep the
              version they pinned.
            </p>
          </header>
          <section className={styles.panel} aria-labelledby="boss-edit-heading">
            <h2 id="boss-edit-heading">Definition</h2>
            <BossForm
              key={formKey}
              initial={bossInputFrom(boss.data.value)}
              submitLabel={`Save as version ${boss.data.value.config_version + 1}`}
              busy={save.pending}
              onSubmit={(input) =>
                boss.data.etag &&
                save.start({ method: 'PUT', path: apiPath`/registry/v1/bosses/${bossId}`, body: input, idempotent: false, ifMatch: boss.data.etag, parse: (value) => bossSchema.parse(value), actor: me })
              }
              feedback={
                save.error ? (
                  <FormAlert title="Boss not saved." correlationId={isApiError(save.error) ? save.error.correlationId : null}>
                    <p>{adminFailure(save.error)}</p>
                    {conflict && (
                      <Button
                        variant="quiet"
                        icon={<RefreshCw size={16} aria-hidden="true" />}
                        busy={boss.isFetching}
                        onClick={async () => {
                          await boss.refetch()
                          save.reset()
                          setFormKey((value) => value + 1)
                        }}
                      >
                        Load latest version
                      </Button>
                    )}
                  </FormAlert>
                ) : save.data ? (
                  <FormAlert title={`Saved as version ${save.data.data.config_version}.`} tone="info" />
                ) : !boss.data.etag ? (
                  <FormAlert title="The server did not provide a version tag, so this boss cannot be saved safely." />
                ) : null
              }
            />
          </section>
        </>
      )}
    </main>
  )
}
