import { describeApiError, isApiError } from '../../api/errors.ts'
import { isUuid } from '../../api/uuid.ts'

/** Server refusals are explained as permissions, never hidden or retried. */
export function adminFailure(error: unknown): string {
  if (isApiError(error) && error.status === 403) return 'Your account is not allowed to do this. The server decides who may administer packages, bosses and occurrences.'
  if (isApiError(error) && error.status === 412) return 'This changed since you loaded it. Load the latest version, review your edits and save again.'
  return describeApiError(error)
}

/** One player ID per line or comma; returns the IDs or the first problem. */
export function parseUserIds(text: string): { ids: string[]; error: string | null } {
  const ids = [...new Set(text.split(/[\s,]+/).map((value) => value.trim().toLowerCase()).filter(Boolean))]
  if (ids.length === 0) return { ids, error: 'Add at least one player ID.' }
  if (ids.length > 20) return { ids, error: 'Use at most 20 player IDs.' }
  const invalid = ids.find((id) => !isUuid(id))
  return { ids, error: invalid ? `${invalid} is not a full player ID.` : null }
}
