import { ApiError } from '../../api/errors.ts'
import { sendRequest, type SessionAuth } from '../../api/http.ts'
import { tokensSchema, userSchema, type Tokens, type User } from './dto.ts'
import { readTokenHints } from './token.ts'

/** Refresh this long before the access token expires. */
export const REFRESH_LEEWAY_MS = 60_000

export type SessionState =
  | { status: 'anonymous'; reason: 'signed_out' | 'expired' | null; revocationConfirmed?: boolean }
  | { status: 'authenticated'; user: User; roles: string[]; packageId: string }

interface HeldTokens {
  access: string
  refresh: string
  expiresAtMs: number
}

type Listener = () => void

/**
 * Memory-only credentials. Nothing is written to storage, cookies or URLs; a reload
 * requires signing in again by design (docs/ARCHITECTURE.md, Session and privacy).
 */
export class SessionStore implements SessionAuth {
  private tokens: HeldTokens | null = null
  private state: SessionState = { status: 'anonymous', reason: null }
  private refreshing: Promise<boolean> | null = null
  private readonly listeners = new Set<Listener>()
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch | undefined
  private readonly now: () => number

  constructor(options: { baseUrl: string; fetchImpl?: typeof fetch; now?: () => number }) {
    this.baseUrl = options.baseUrl
    this.fetchImpl = options.fetchImpl
    this.now = options.now ?? Date.now
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): SessionState => this.state

  private setState(state: SessionState) {
    this.state = state
    for (const listener of this.listeners) listener()
  }

  private hold(tokens: Tokens) {
    const hinted = readTokenHints(tokens.access_token).expiresAtMs
    this.tokens = {
      access: tokens.access_token,
      refresh: tokens.refresh_token,
      expiresAtMs: hinted ?? this.now() + tokens.expires_in * 1000,
    }
  }

  /** Login, then load identity from /users/me; token claims are hints only. */
  async login(input: { email: string; password: string; packageId: string }, signal?: AbortSignal): Promise<User> {
    const options = { baseUrl: this.baseUrl, accessToken: null, fetchImpl: this.fetchImpl }
    const { data: tokens } = await sendRequest(
      {
        method: 'POST',
        path: '/users/v1/users/login',
        auth: 'public',
        body: { email: input.email, password: input.password, package_id: input.packageId },
        parse: (value) => tokensSchema.parse(value),
        signal,
      },
      options,
    )
    const { data: user } = await sendRequest(
      { method: 'GET', path: '/users/v1/users/me', auth: 'user', parse: (value) => userSchema.parse(value), signal },
      { ...options, accessToken: tokens.access_token },
    )
    this.hold(tokens)
    this.setState({
      status: 'authenticated',
      user,
      roles: readTokenHints(tokens.access_token).roles,
      packageId: input.packageId,
    })
    return user
  }

  /** Updates identity after a /users/me reload (e.g. after joining a package). */
  updateUser(user: User) {
    if (this.state.status === 'authenticated' && this.state.user.user_id === user.user_id) {
      this.setState({ ...this.state, user })
    }
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.tokens) return null
    if (this.tokens.expiresAtMs - this.now() <= REFRESH_LEEWAY_MS) {
      const refreshed = await this.refresh()
      if (!refreshed) return null
    }
    return this.tokens?.access ?? null
  }

  async refreshAfterUnauthorized(rejectedToken: string): Promise<boolean> {
    if (!this.tokens) return false
    if (this.tokens.access !== rejectedToken) return true
    return this.refresh()
  }

  /** One shared in-flight refresh; both tokens rotate together. */
  private refresh(): Promise<boolean> {
    if (this.refreshing) return this.refreshing
    const current = this.tokens
    if (!current) return Promise.resolve(false)
    this.refreshing = sendRequest(
      {
        method: 'POST',
        path: '/users/v1/auth/refresh',
        auth: 'public',
        body: { refresh_token: current.refresh },
        parse: (value) => tokensSchema.parse(value),
      },
      { baseUrl: this.baseUrl, accessToken: null, fetchImpl: this.fetchImpl },
    )
      .then(({ data }) => {
        if (this.tokens !== current) return this.tokens !== null
        this.hold(data)
        if (this.state.status === 'authenticated') {
          this.setState({ ...this.state, roles: readTokenHints(data.access_token).roles })
        }
        return true
      })
      .catch((error: unknown) => {
        // A refused refresh ends the session; transport failures keep it for a later attempt.
        if (error instanceof ApiError && error.kind === 'http' && error.status !== null && error.status < 500) {
          if (this.tokens === current) this.end('expired')
          return false
        }
        throw error
      })
      .finally(() => {
        this.refreshing = null
      })
    return this.refreshing
  }

  /** Attempts revocation, then always clears local credentials. */
  async logout(): Promise<{ revoked: boolean }> {
    const current = this.tokens
    let revoked = false
    if (current) {
      try {
        await sendRequest(
          { method: 'POST', path: '/users/v1/auth/logout', auth: 'public', body: { refresh_token: current.refresh } },
          { baseUrl: this.baseUrl, accessToken: null, fetchImpl: this.fetchImpl },
        )
        revoked = true
      } catch {
        revoked = false
      }
    }
    this.end('signed_out', revoked)
    return { revoked }
  }

  end(reason: 'signed_out' | 'expired', revocationConfirmed?: boolean) {
    this.tokens = null
    this.refreshing = null
    this.setState(
      revocationConfirmed === undefined ? { status: 'anonymous', reason } : { status: 'anonymous', reason, revocationConfirmed },
    )
  }
}
