import { useSyncExternalStore } from 'react'

/**
 * Memory-only convenience: the guild a user last opened or joined. It is a hint
 * that must be verified against the roster; no current-user-guild API exists.
 */
const selected = new Map<string, string>()
const sent = new Map<string, { invitationId: string; guildId: string; invitedUserId: string }[]>()
const listeners = new Set<() => void>()
let version = 0

function emit() {
  version += 1
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function rememberGuild(userId: string, guildId: string | null) {
  if (guildId === null) selected.delete(userId)
  else selected.set(userId, guildId)
  emit()
}

export function rememberSentInvitation(userId: string, entry: { invitationId: string; guildId: string; invitedUserId: string }) {
  sent.set(userId, [...(sent.get(userId) ?? []).filter((item) => item.invitationId !== entry.invitationId), entry])
  emit()
}

export function forgetSentInvitation(userId: string, invitationId: string) {
  sent.set(userId, (sent.get(userId) ?? []).filter((item) => item.invitationId !== invitationId))
  emit()
}

export function useGuildHints(userId: string) {
  useSyncExternalStore(subscribe, () => version)
  return { selectedGuildId: selected.get(userId) ?? null, sentInvitations: sent.get(userId) ?? [] }
}
