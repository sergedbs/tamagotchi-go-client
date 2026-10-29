import { isUuid } from '../../api/uuid.ts'

/**
 * Which player this browser's push subscription belongs to, and the server
 * device ID once registration succeeded. Not a credential and never the device
 * token: it only lets logout and account switching remove the subscription after
 * a reload, since sessions themselves are memory-only.
 */
export interface PushOwner {
  user_id: string
  device_id: string | null
}

const KEY = 'tamagotchi-go.push-owner'
const listeners = new Set<() => void>()
let cache: { raw: string | null; owner: PushOwner | null } = { raw: null, owner: null }

function parse(raw: string | null): PushOwner | null {
  try {
    const value = JSON.parse(raw ?? 'null') as Partial<PushOwner> | null
    if (!value || !isUuid(value.user_id ?? '')) return null
    return { user_id: value.user_id!, device_id: typeof value.device_id === 'string' && isUuid(value.device_id) ? value.device_id : null }
  } catch {
    return null
  }
}

/** Stable snapshot for useSyncExternalStore. */
export function readOwner(): PushOwner | null {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    // Storage blocked: behaves as if push was never turned on here.
  }
  if (raw !== cache.raw) cache = { raw, owner: parse(raw) }
  return cache.owner
}

export function writeOwner(owner: PushOwner | null) {
  try {
    if (owner) localStorage.setItem(KEY, JSON.stringify(owner))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage blocked: push still works for this page; cleanup falls back to the next turn-off.
  }
  for (const listener of listeners) listener()
}

export function subscribeOwner(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * On sign-in: a subscription owned by another player must not keep delivering
 * here, so it is released; the owner's own subscription keeps foreground updates.
 */
export function ownerAction(owner: PushOwner | null, userId: string, permission: NotificationPermission): 'none' | 'release' | 'listen' {
  if (!owner) return 'none'
  if (owner.user_id !== userId) return 'release'
  return permission === 'granted' ? 'listen' : 'none'
}
