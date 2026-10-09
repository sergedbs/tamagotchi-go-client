import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { apiPath } from '../../api/http.ts'
import { useCommand } from '../../api/useCommand.ts'
import { Button } from '../../components/Button.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import type { WithEtag } from '../creatures/api.ts'
import { NOTIFICATION_TYPES, notificationKeys, preferencesSchema, usePreferences, type NotificationType, type Preferences } from '../notifications/api.ts'
import { CATEGORY_LABEL } from '../notifications/templates.ts'
import styles from './AccountPage.module.css'

/** Category preferences, written with the exact ETag from the last read. */
export function NotificationSettings({ userId }: { userId: string }) {
  const preferences = usePreferences(userId)
  return (
    <section aria-labelledby="preferences-heading" className={styles.section}>
      <h2 id="preferences-heading">Notification categories</h2>
      {preferences.isPending ? (
        <p className={styles.muted}>Loading preferences…</p>
      ) : preferences.isError ? (
        <FormAlert title="Preferences could not be loaded." correlationId={isApiError(preferences.error) ? preferences.error.correlationId : null}>
          {describeApiError(preferences.error)}
        </FormAlert>
      ) : (
        <PreferencesForm userId={userId} current={preferences.data} onReload={() => void preferences.refetch()} />
      )}
    </section>
  )
}

function PreferencesForm({ userId, current, onReload }: { userId: string; current: WithEtag<Preferences>; onReload: () => void }) {
  const queryClient = useQueryClient()
  // Unsaved edits; null shows the server's current preferences.
  const [draft, setDraft] = useState<NotificationType[] | null>(null)
  const [saved, setSaved] = useState(false)
  const muted = draft ?? current.value.muted_categories
  const save = useCommand<Preferences>({
    onSuccess: (response) => {
      queryClient.setQueryData<WithEtag<Preferences>>(notificationKeys.preferences(userId), { value: response.data, etag: response.etag })
      setDraft(null)
      setSaved(true)
    },
    onError: (error) => {
      if (isApiError(error) && error.status === 412) {
        setDraft(null)
        onReload()
      }
    },
  })
  const changed = muted.length !== current.value.muted_categories.length || muted.some((type) => !current.value.muted_categories.includes(type))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!current.etag) return
    setSaved(false)
    save.start({
      method: 'PUT',
      path: apiPath`/notification/v1/users/${userId}/preferences`,
      body: { muted_categories: NOTIFICATION_TYPES.filter((type) => muted.includes(type)) },
      idempotent: false,
      ifMatch: current.etag,
      parse: (value) => preferencesSchema.parse(value),
      actor: userId,
    })
  }

  return (
    <form className={styles.preferences} onSubmit={submit}>
      <fieldset>
        <legend className={styles.muted}>Muted categories still reach your inbox; only push delivery is muted.</legend>
        {NOTIFICATION_TYPES.map((type) => (
          <label key={type} className={styles.check}>
            <input
              type="checkbox"
              checked={!muted.includes(type)}
              onChange={(event) => {
                setSaved(false)
                setDraft(event.target.checked ? muted.filter((item) => item !== type) : [...muted, type])
              }}
            />
            {CATEGORY_LABEL[type]}
          </label>
        ))}
      </fieldset>
      {!current.etag && <FormAlert title="The server did not provide a version tag, so preferences cannot be saved safely." />}
      {save.error && (
        <FormAlert title="Preferences not saved." correlationId={isApiError(save.error) ? save.error.correlationId : null}>
          {isApiError(save.error) && save.error.status === 412 ? 'They changed elsewhere and have been reloaded. Review and save again.' : describeApiError(save.error)}
        </FormAlert>
      )}
      {saved && !changed && <FormAlert title="Preferences saved." tone="info" />}
      <Button type="submit" variant="secondary" disabled={!changed || !current.etag} busy={save.pending}>
        Save preferences
      </Button>
    </form>
  )
}
