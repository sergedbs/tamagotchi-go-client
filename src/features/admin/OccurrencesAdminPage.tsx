import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { isApiError } from '../../api/errors.ts'
import { apiPath } from '../../api/http.ts'
import { useCommand } from '../../api/useCommand.ts'
import { Button } from '../../components/Button.tsx'
import { ConfirmDialog } from '../../components/ConfirmDialog.tsx'
import { SelectField, TextField } from '../../components/Field.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { LoadProblem } from '../../components/LoadProblem.tsx'
import { formatAbsolute } from '../../lib/time.ts'
import { useNow } from '../../lib/useNow.ts'
import { useAuthenticated } from '../auth/sessionContext.ts'
import { occurrenceSchema, type Boss, type Occurrence } from '../combat/raids/api.ts'
import { occurrenceAvailability } from '../combat/status.ts'
import { AdminNav } from './AdminNav.tsx'
import { adminKeys, occurrenceReceiptSchema, useAdminBosses, useAdminOccurrences } from './api.ts'
import { adminFailure } from './denied.ts'
import styles from './Admin.module.css'

type Receipt = { occurrence: Occurrence; runtime_propagation: string }
type Transition = 'activate' | 'deactivate' | 'cancel'

const TRANSITIONS: Record<Occurrence['status'], Transition[]> = {
  scheduled: ['activate', 'cancel'],
  active: ['deactivate', 'cancel'],
  inactive: ['activate', 'cancel'],
  cancelled: [],
}
const LABEL: Record<Transition, string> = { activate: 'Activate', deactivate: 'Deactivate', cancel: 'Cancel' }

/** datetime-local value in the viewer's zone. */
function localInput(ms: number): string {
  const date = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000)
  return date.toISOString().slice(0, 16)
}

function availabilityLabel(occurrence: Occurrence, availability: ReturnType<typeof occurrenceAvailability>, now: number): string {
  if (availability === 'available') return 'Open now'
  if (availability === 'upcoming') return 'Opens later'
  const insideWindow = Date.parse(occurrence.available_from) <= now && now < Date.parse(occurrence.available_until)
  return insideWindow && occurrence.status !== 'cancelled' ? 'Not active yet' : 'Closed'
}

export default function OccurrencesAdminPage() {
  const { user } = useAuthenticated()
  const me = user.user_id
  const occurrences = useAdminOccurrences(me)
  const bosses = useAdminBosses(me)
  const now = useNow()
  const bossList = bosses.data?.pages.flatMap((page) => page.items) ?? []
  const nameOf = (bossId: string) => bossList.find((boss) => boss.boss_id === bossId)?.definition.name ?? `Boss ${bossId.slice(-6)}`
  const items = occurrences.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <main className={styles.page}>
      <AdminNav />
      <header className={styles.header}>
        <h1>Raid occurrences</h1>
        <p className={styles.lead}>An occurrence opens a pinned boss version for a time window. Players can start raids only while it is active and open.</p>
      </header>
      <CreateOccurrence userId={me} bosses={bossList} />
      {occurrences.isPending ? (
        <p className={styles.muted}>Loading occurrences…</p>
      ) : occurrences.isError ? (
        <LoadProblem title="Occurrences could not be loaded" message={adminFailure(occurrences.error)} correlationId={isApiError(occurrences.error) ? occurrences.error.correlationId : null} onRetry={() => void occurrences.refetch()} />
      ) : items.length === 0 ? (
        <p className={styles.muted}>No occurrences yet.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="visually-hidden">Raid occurrences</caption>
            <thead>
              <tr>
                <th scope="col">Boss</th>
                <th scope="col">Window</th>
                <th scope="col">Status</th>
                <th scope="col">Players</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((occurrence) => (
                <OccurrenceRow key={occurrence.occurrence_id} userId={me} occurrence={occurrence} bossName={nameOf(occurrence.boss_id)} now={now} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {occurrences.hasNextPage && (
        <Button variant="secondary" busy={occurrences.isFetchingNextPage} onClick={() => void occurrences.fetchNextPage()}>
          Load more occurrences
        </Button>
      )}
    </main>
  )
}

function OccurrenceRow({ userId, occurrence, bossName, now }: { userId: string; occurrence: Occurrence; bossName: string; now: number }) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const transition = useCommand<Receipt>({
    onSuccess: () => {
      setConfirming(false)
      void queryClient.invalidateQueries({ queryKey: adminKeys.occurrences(userId) })
      void queryClient.invalidateQueries({ queryKey: ['user', userId, 'occurrences'] })
    },
  })
  const run = (action: Transition) =>
    transition.start({
      method: 'POST',
      path: apiPath`/registry/v1/raid-occurrences/${occurrence.occurrence_id}/${action}`,
      idempotent: true,
      parse: (value) => occurrenceReceiptSchema.parse(value),
      actor: userId,
    })
  const availability = occurrenceAvailability(occurrence, now)

  return (
    <tr>
      <th scope="row">
        {bossName} <span className={styles.muted}>v{occurrence.boss_version}</span>
      </th>
      <td>
        <span title={formatAbsolute(occurrence.available_from)}>{new Date(occurrence.available_from).toLocaleString()}</span>
        {' – '}
        <span title={formatAbsolute(occurrence.available_until)}>{new Date(occurrence.available_until).toLocaleString()}</span>
      </td>
      <td>
        <span className={styles.status} data-status={occurrence.status}>
          {occurrence.status}
        </span>
      </td>
      <td>{availabilityLabel(occurrence, availability, now)}</td>
      <td>
        <div className={styles.rowActions}>
          {TRANSITIONS[occurrence.status].map((action) => (
            <Button key={action} variant={action === 'cancel' ? 'quiet' : 'secondary'} busy={transition.pending && transition.command?.path.endsWith(`/${action}`)} disabled={transition.pending} onClick={() => (action === 'cancel' ? setConfirming(true) : run(action))}>
              {LABEL[action]}
            </Button>
          ))}
        </div>
        {transition.data && transition.data.data.runtime_propagation === 'PENDING' && <p className={styles.muted}>Saved; the raid service picks this up shortly.</p>}
        {transition.error && !confirming && (
          <FormAlert title={transition.uncertain ? 'Not confirmed.' : 'Refused.'} correlationId={isApiError(transition.error) ? transition.error.correlationId : null}>
            <p>{adminFailure(transition.error)}</p>
            {transition.uncertain && (
              <Button variant="quiet" onClick={transition.retry}>
                Retry same request
              </Button>
            )}
          </FormAlert>
        )}
        <ConfirmDialog
          open={confirming}
          title="Cancel this occurrence?"
          tone="danger"
          confirmLabel="Cancel occurrence"
          busy={transition.pending}
          onClose={() => {
            setConfirming(false)
            transition.reset()
          }}
          onConfirm={() => run('cancel')}
          feedback={transition.error ? <FormAlert title="Not cancelled.">{adminFailure(transition.error)}</FormAlert> : null}
        >
          <p>Players can no longer start raids on it. Raids already running keep their pinned boss version.</p>
        </ConfirmDialog>
      </td>
    </tr>
  )
}

function CreateOccurrence({ userId, bosses }: { userId: string; bosses: Boss[] }) {
  const [open, setOpen] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const [form, setForm] = useState({ bossId: '', version: '', from: localInput(startedAt), until: localInput(startedAt + 3_600_000) })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const queryClient = useQueryClient()
  const create = useCommand<Occurrence>({
    onSuccess: () => {
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: adminKeys.occurrences(userId) })
    },
  })
  const boss = bosses.find((item) => item.boss_id === form.bossId)

  if (!open) {
    return (
      <Button variant="secondary" icon={<Plus size={18} aria-hidden="true" />} onClick={() => setOpen(true)} className={styles.start}>
        Schedule an occurrence
      </Button>
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const from = Date.parse(form.from)
    const until = Date.parse(form.until)
    const version = Number(form.version || boss?.config_version)
    const next: Record<string, string> = {}
    if (!boss) next.bossId = 'Choose a boss.'
    if (boss && (!Number.isInteger(version) || version < 1 || version > boss.config_version)) next.version = `Use a version from 1 to ${boss.config_version}.`
    if (Number.isNaN(from)) next.from = 'Choose a start time.'
    if (Number.isNaN(until)) next.until = 'Choose an end time.'
    else if (!Number.isNaN(from) && until <= from) next.until = 'The window must end after it starts.'
    setErrors(next)
    if (Object.keys(next).length > 0 || !boss) return
    create.start({
      method: 'POST',
      path: '/registry/v1/raid-occurrences',
      body: { boss_id: boss.boss_id, boss_version: version, available_from: new Date(from).toISOString(), available_until: new Date(until).toISOString() },
      idempotent: true,
      parse: (value) => occurrenceSchema.parse(value),
      actor: userId,
    })
  }

  return (
    <section className={styles.panel} aria-labelledby="create-occurrence-heading">
      <h2 id="create-occurrence-heading">Schedule an occurrence</h2>
      <form className={styles.form} onSubmit={submit} noValidate>
        <SelectField label="Boss" value={form.bossId} error={errors.bossId} onChange={(event) => setForm({ ...form, bossId: event.target.value, version: '' })}>
          <option value="">Choose a boss</option>
          {bosses.map((item) => (
            <option key={item.boss_id} value={item.boss_id}>
              {item.definition.name} (v{item.config_version})
            </option>
          ))}
        </SelectField>
        <TextField
          label="Boss version"
          inputMode="numeric"
          hint={boss ? `Pins this version's stats and rewards. Latest is v${boss.config_version}.` : 'Pins a boss version.'}
          placeholder={boss ? String(boss.config_version) : ''}
          value={form.version}
          error={errors.version}
          onChange={(event) => setForm({ ...form, version: event.target.value })}
        />
        <div className={styles.grid}>
          <TextField label="Opens" type="datetime-local" value={form.from} error={errors.from} onChange={(event) => setForm({ ...form, from: event.target.value })} />
          <TextField label="Closes" type="datetime-local" value={form.until} error={errors.until} onChange={(event) => setForm({ ...form, until: event.target.value })} />
        </div>
        <p className={styles.muted}>Times are in your time zone and sent as UTC. A new occurrence may need activating before players can use it.</p>
        {create.error && (
          <FormAlert title={create.uncertain ? 'We could not confirm the occurrence was created.' : 'Occurrence not created.'} correlationId={isApiError(create.error) ? create.error.correlationId : null}>
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
            Schedule occurrence
          </Button>
        </div>
      </form>
    </section>
  )
}
