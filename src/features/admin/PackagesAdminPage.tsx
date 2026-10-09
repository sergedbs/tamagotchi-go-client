import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { useCommand } from '../../api/useCommand.ts'
import { Button } from '../../components/Button.tsx'
import { TextAreaField, TextField } from '../../components/Field.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { LoadProblem } from '../../components/LoadProblem.tsx'
import { packageSchema, type Package } from '../auth/dto.ts'
import { usePublicPackages } from '../auth/packagesApi.ts'
import { useAuthenticated } from '../auth/sessionContext.ts'
import { AdminNav } from './AdminNav.tsx'
import { useAdminAccess } from './access.ts'
import { adminFailure, parseUserIds } from './denied.ts'
import styles from './Admin.module.css'

export default function PackagesAdminPage() {
  const { user } = useAuthenticated()
  const access = useAdminAccess()
  const packages = usePublicPackages()
  const items = packages.data?.items ?? []
  const roleOf = (pkg: Package) =>
    pkg.moderator_user_ids.includes(user.user_id) ? 'Moderator' : pkg.developer_user_ids.includes(user.user_id) ? 'Developer' : access.isAdmin ? 'Admin' : 'None'

  return (
    <main className={styles.page}>
      <AdminNav />
      <header className={styles.header}>
        <h1>Packages</h1>
        <p className={styles.lead}>Package metadata and configuration versions. The server authorizes every change.</p>
      </header>
      {access.isAdmin && <CreatePackage userId={user.user_id} />}
      {packages.isPending ? (
        <p className={styles.muted}>Loading packages…</p>
      ) : packages.isError ? (
        <LoadProblem title="Packages could not be loaded" message={describeApiError(packages.error)} correlationId={isApiError(packages.error) ? packages.error.correlationId : null} onRetry={() => void packages.refetch()} />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="visually-hidden">Packages</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Version</th>
                <th scope="col">Status</th>
                <th scope="col">Configuration</th>
                <th scope="col">Revision</th>
                <th scope="col">Your access</th>
              </tr>
            </thead>
            <tbody>
              {items.map((pkg) => (
                <tr key={pkg.package_id}>
                  <th scope="row">
                    <Link to={`/admin/packages/${pkg.package_id}`}>{pkg.name}</Link>
                  </th>
                  <td data-label="Version">{pkg.version}</td>
                  <td data-label="Status">
                    <span className={styles.status} data-status={pkg.status}>
                      {pkg.status}
                    </span>
                  </td>
                  <td data-label="Configuration" className="tabular">
                    {pkg.config_version === null ? 'None yet' : `v${pkg.config_version}`}
                  </td>
                  <td data-label="Revision" className="tabular">
                    {pkg.revision}
                  </td>
                  <td data-label="Your access">{roleOf(pkg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {packages.data?.truncated && <p className={styles.muted}>Only the first pages of packages are listed.</p>}
    </main>
  )
}

function CreatePackage({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', version: '0.1.0', developers: userId, moderators: userId })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const create = useCommand<Package>({
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: ['public', 'packages'] })
      navigate(`/admin/packages/${response.data.package_id}`)
    },
  })

  if (!open) {
    return (
      <Button variant="secondary" icon={<Plus size={18} aria-hidden="true" />} onClick={() => setOpen(true)} className={styles.start}>
        Create a package
      </Button>
    )
  }

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
    if (Object.keys(next).length > 0) return
    create.start({
      method: 'POST',
      path: '/registry/v1/packages',
      body: { name: form.name.trim(), description: form.description, version: form.version.trim(), developer_user_ids: developers.ids, moderator_user_ids: moderators.ids },
      idempotent: true,
      parse: (value) => packageSchema.parse(value),
      actor: userId,
    })
  }

  return (
    <section className={styles.panel} aria-labelledby="create-package-heading">
      <h2 id="create-package-heading">Create a package</h2>
      <form className={styles.form} onSubmit={submit} noValidate>
        <TextField label="Name" value={form.name} error={errors.name} maxLength={64} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <TextAreaField label="Description" value={form.description} error={errors.description} maxLength={1000} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <TextField label="Version" value={form.version} error={errors.version} maxLength={32} onChange={(event) => setForm({ ...form, version: event.target.value })} />
        <TextAreaField label="Developer player IDs" hint="One per line, 1 to 20." value={form.developers} error={errors.developers} rows={2} onChange={(event) => setForm({ ...form, developers: event.target.value })} />
        <TextAreaField label="Moderator player IDs" hint="Moderators can edit this package and publish configurations." value={form.moderators} error={errors.moderators} rows={2} onChange={(event) => setForm({ ...form, moderators: event.target.value })} />
        <p className={styles.muted}>A new package has no configuration, so players cannot join it until one is published.</p>
        {create.error && (
          <FormAlert title={create.uncertain ? 'We could not confirm the package was created.' : 'Package not created.'} correlationId={isApiError(create.error) ? create.error.correlationId : null}>
            <p>{adminFailure(create.error)}</p>
            {create.uncertain && (
              <Button variant="quiet" onClick={create.retry}>
                Retry same request
              </Button>
            )}
          </FormAlert>
        )}
        <div className={styles.actions}>
          <Button variant="quiet" onClick={() => setOpen(false)} disabled={create.pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={create.pending}>
            Create package
          </Button>
        </div>
      </form>
    </section>
  )
}
