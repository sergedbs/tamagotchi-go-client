import type { PushConfig } from '../../app/config.ts'
import { isApiError } from '../../api/errors.ts'
import { apiPath, type ApiClient } from '../../api/http.ts'
import { writeOwner, type PushOwner } from './owner.ts'
import { releasePush } from './push.ts'

/**
 * Turn-off and sign-out path: removes this browser's device entry (best effort,
 * while the session can still authorize it), then ends delivery locally. Returns
 * whether the server entry is known to be gone.
 */
export async function turnOffPush(api: ApiClient, config: PushConfig | null, owner: PushOwner): Promise<boolean> {
  let removed = true
  if (owner.device_id) {
    try {
      await api.request({ method: 'DELETE', path: apiPath`/notification/v1/devices/${owner.device_id}`, auth: 'user' })
    } catch (error) {
      removed = isApiError(error) && error.status === 404
    }
  }
  await releasePush(config).catch(() => undefined)
  writeOwner(null)
  return removed
}
