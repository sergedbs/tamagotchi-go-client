import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { apiPath } from '../../api/http.ts'
import { useCommand } from '../../api/useCommand.ts'
import { isUuid } from '../../api/uuid.ts'
import { NotFound } from '../../app/NotFound.tsx'
import { Button } from '../../components/Button.tsx'
import { SelectField, TextAreaField, TextField } from '../../components/Field.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { LoadProblem } from '../../components/LoadProblem.tsx'
import { packageSchema, type Package } from '../auth/dto.ts'
import { useAuthenticated } from '../auth/sessionContext.ts'
import type { WithEtag } from '../creatures/api.ts'
import { AdminNav } from './AdminNav.tsx'
import { adminKeys, useAdminPackage } from './api.ts'
import { ConfigEditor } from './ConfigEditor.tsx'
import { adminFailure, parseUserIds } from './denied.ts'
import styles from './Admin.module.css'

export default function PackageAdminPage() {
  const { id } = useParams()
  if (!isUuid(id)) return <NotFound />
  return <PackageAdmin key={id} packageId={id.toLowerCase()} />
}

function PackageAdmin({ packageId }: { packageId: string }) {
  const { user } = useAuthenticated()
  const pkg = useAdminPackage(user.user_id, packageId)
  // Bumped to discard local edits after loading the latest version.
  const [formKey, setFormKey] = useState(0)

  return (
    <main className={styles.page}>
      <AdminNav />
      <Link to="/admin/packages" className={styles.back}>
        <ArrowLeft size={18} aria-hidden="true" /> Packages
      </Link>
      {pkg.isPending ? (
        <p className={styles.muted}>Loading package…</p>
      ) : pkg.isError ? (
        <LoadProblem title="This package could not be loaded" message={describeApiError(pkg.error)} correlationId={isApiError(pkg.error) ? pkg.error.correlationId : null} onRetry={() => void pkg.refetch()} />
      ) : (
        <>
          <header className={styles.header}>
            <h1>{pkg.data.value.name}</h1>
            <p className={styles.muted}>
              {pkg.data.value.status} · version {pkg.data.value.version} · revision {pkg.data.value.revision} ·{' '}
              {pkg.data.value.config_version === null ? 'no configuration yet' : `configuration v${pkg.data.value.config_version}`}
            </p>
          </header>
          <div className={styles.columns}>
            <MetadataForm
              key={formKey}
              userId={user.user_id}
              current={pkg.data}
              refreshing={pkg.isFetching}
              onReload={async () => {
                await pkg.refetch()
                setFormKey((value) => value + 1)
              }}
            />
            <ConfigEditor userId={user.user_id} pkg={pkg.data.value} />
          </div>
        </>
      )}
    </main>
  )
}

function MetadataForm({ userId, current, refreshing, onReload }: { userId: string; current: WithEtag<Package>; refreshing: boolean; onReload: () => void }) {
  const queryClient = useQueryClient()
  const pkg = current.value
  const [form, setForm] = useState({
    name: pkg.name,
    description: pkg.description,
    version: pkg.version,
    status: pkg.status,
    developers: pkg.developer_user_ids.join('\n'),
    moderators: pkg.moderator_user_ids.join('\n'),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useCommand<Package>({
    onSuccess: (response) => {
      queryClient.setQueryData<WithEtag<Package>>(adminKeys.package(userId, pkg.package_id), { value: response.data, etag: response.etag })
      void queryClient.invalidateQueries({ queryKey: ['public', 'packages'] })
    },
  })
  const conflict = isApiError(save.error) && save.error.status === 412

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const developers = parseUserIds(form.developers)
    const moderators = parseUserIds(form.moderators)
    const next: Record<string, string> = {}
    if (form.name.trim().length < 3 || form.name.trim().length > 64) next.name = 'Use 3 to 64 characters.'
    if (form.description.length > 1000) next.description = 'Use at most 1000 characters.'
    if (!form.version.trim() || form.version.trim().length > 32) next.version = 'Use 1 to 32 characters.'
    if (developers.error) next.developers = developers.error
    if (moderators.error) next.moderators = moderators.error
    setErrors(next)
    if (Object.keys(next).length > 0 || !current.etag) return
    save.start({
      method: 'PATCH',
      path: apiPath`/registry/v1/packages/${pkg.package_id}`,
      body: { name: form.name.trim(), description: form.description, version: form.version.trim(), status: form.status, developer_user_ids: developers.ids, moderator_user_ids: moderators.ids },
      // The live Registry also requires an Idempotency-Key here (not in the contract table).
      idempotent: true,
      ifMatch: current.etag,
      parse: (value) => packageSchema.parse(value),
      actor: userId,
    })
  }

  return (
    <section className={styles.panel} aria-labelledby="metadata-heading">
      <h2 id="metadata-heading">Metadata</h2>
      <form className={styles.form} onSubmit={submit} noValidate>
        <TextField label="Name" value={form.name} error={errors.name} maxLength={64} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <TextAreaField label="Description" value={form.description} error={errors.description} maxLength={1000} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <TextField label="Version" value={form.version} error={errors.version} maxLength={32} onChange={(event) => setForm({ ...form, version: event.target.value })} />
        <SelectField label="Status" value={form.status} hint="Inactive packages accept no new players." onChange={(event) => setForm({ ...form, status: event.target.value as Package['status'] })}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </SelectField>
        <TextAreaField label="Developer player IDs" hint="One per line, 1 to 20." value={form.developers} error={errors.developers} rows={3} onChange={(event) => setForm({ ...form, developers: event.target.value })} />
        <TextAreaField label="Moderator player IDs" hint="One per line, 1 to 20." value={form.moderators} error={errors.moderators} rows={3} onChange={(event) => setForm({ ...form, moderators: event.target.value })} />
        {!current.etag && <FormAlert title="The server did not provide a version tag, so metadata cannot be saved safely." />}
        {save.error && (
          <FormAlert title="Metadata not saved." correlationId={isApiError(save.error) ? save.error.correlationId : null}>
            <p>{adminFailure(save.error)}</p>
            {conflict && (
              <Button variant="quiet" icon={<RefreshCw size={16} aria-hidden="true" />} busy={refreshing} onClick={onReload}>
                Load latest version
              </Button>
            )}
          </FormAlert>
        )}
        {save.data && !save.error && <FormAlert title={`Saved as revision ${save.data.data.revision}.`} tone="info" />}
        <Button type="submit" variant="primary" busy={save.pending} disabled={!current.etag} className={styles.submit}>
          Save metadata
        </Button>
      </form>
    </section>
  )
}
