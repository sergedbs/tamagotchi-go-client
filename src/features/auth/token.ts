/**
 * Reads JWT claims as UI hints only (expiry, roles). The server verifies tokens;
 * nothing here is a security decision.
 */
export interface TokenHints {
  expiresAtMs: number | null
  roles: string[]
}

export function readTokenHints(token: string): TokenHints {
  try {
    const payload = token.split('.')[1]
    if (!payload) return { expiresAtMs: null, roles: [] }
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
    const roles = Array.isArray(claims.roles) ? claims.roles.filter((role): role is string => typeof role === 'string') : []
    const exp = typeof claims.exp === 'number' ? claims.exp * 1000 : null
    return { expiresAtMs: exp, roles }
  } catch {
    return { expiresAtMs: null, roles: [] }
  }
}
