import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { Button } from '../../components/Button.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { SelectField, TextField } from '../../components/Field.tsx'
import type { Package } from './dto.ts'
import { safeNext } from './next.ts'
import { packageLabel, usePublicPackages } from './packagesApi.ts'
import { useSession, useSessionStore } from './sessionContext.ts'
import { useRetryAfter } from './useRetryAfter.ts'
import styles from './AuthForms.module.css'

interface LoginState {
  email?: string
  packageId?: string
}

export default function LoginPage() {
  const session = useSession()
  const store = useSessionStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const location = useLocation()
  const incoming = (location.state ?? {}) as LoginState
  const packages = usePublicPackages()
  const [email, setEmail] = useState(incoming.email ?? '')
  const [password, setPassword] = useState('')
  const [packageId, setPackageId] = useState(incoming.packageId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [missing, setMissing] = useState<Record<string, string>>({})
  const throttle = useRetryAfter()
  const next = safeNext(params.get('next'))

  if (session.status === 'authenticated' && !busy) return <Navigate to={next} replace />

  const active = packages.data?.items.filter((pkg) => pkg.status === 'active') ?? []
  const selected = active.find((pkg) => pkg.package_id === packageId)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const problems: Record<string, string> = {}
    if (!packageId) problems.package = 'Choose the package you play in.'
    if (!email.trim()) problems.email = 'Enter your email.'
    if (!password) problems.password = 'Enter your password.'
    setMissing(problems)
    if (Object.keys(problems).length > 0) return
    setBusy(true)
    setError(null)
    try {
      await store.login({ email: email.trim(), password, packageId })
      navigate(next, { replace: true })
    } catch (caught) {
      setError(caught)
      if (isApiError(caught) && caught.status === 429) throttle.wait(caught.retryAfterSeconds ?? 5)
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-labelledby="login-title">
      <div className={styles.heading}>
        <h1 id="login-title">Welcome back</h1>
        <p>Sign in to check on your companions.</p>
      </div>
      {!error && session.status === 'anonymous' && session.reason === 'expired' && (
        <FormAlert title="Your session ended. Sign in again to continue." tone="info" />
      )}
      {!error && session.status === 'anonymous' && session.reason === 'signed_out' && (
        <FormAlert title="You are signed out." tone="info">
          {session.revocationConfirmed === false
            ? 'Local credentials were cleared, but the server could not confirm the sign-out.'
            : null}
        </FormAlert>
      )}
      {error !== null && <LoginError error={error} packageName={selected?.name} />}
      <PackageSelect
        value={packageId}
        onChange={setPackageId}
        packages={active}
        loading={packages.isPending}
        failed={packages.isError}
        onRetry={() => void packages.refetch()}
        error={missing.package}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={missing.email}
        required
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={missing.password}
        required
      />
      <Button type="submit" variant="primary" block busy={busy} disabled={throttle.remaining > 0}>
        {throttle.remaining > 0 ? `Try again in ${throttle.remaining} s` : 'Sign in'}
      </Button>
      <p className={styles.switch}>
        New here? <Link to="/register">Create an account</Link>
      </p>
    </form>
  )
}

function LoginError({ error, packageName }: { error: unknown; packageName?: string }) {
  if (isApiError(error) && error.code === 'invalid_credentials') {
    return <FormAlert title="Email or password is incorrect." />
  }
  if (isApiError(error) && error.code === 'package_membership_required') {
    return (
      <FormAlert title={`This account has not joined ${packageName ?? 'that package'}.`}>
        Choose a package you already play in. You can join more packages from Account after signing in.
      </FormAlert>
    )
  }
  return <FormAlert title="Sign-in did not complete." correlationId={isApiError(error) ? error.correlationId : null}>{describeApiError(error)}</FormAlert>
}

export function PackageSelect(props: {
  value: string
  onChange: (value: string) => void
  packages: Package[]
  loading: boolean
  failed: boolean
  onRetry: () => void
  error?: string
  hint?: string
  disableUnconfigured?: boolean
}) {
  if (props.failed) {
    return (
      <FormAlert title="Packages could not be loaded.">
        Sign-in needs the package list from the server.{' '}
        <button type="button" className={styles.inlineRetry} onClick={props.onRetry}>
          Try again
        </button>
      </FormAlert>
    )
  }
  return (
    <SelectField
      label="Package"
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      disabled={props.loading}
      error={props.error}
      hint={props.hint}
      required
    >
      <option value="">{props.loading ? 'Loading packages…' : 'Choose a package'}</option>
      {props.packages.map((pkg) => {
        const unconfigured = props.disableUnconfigured && pkg.config_version === null
        return (
          <option key={pkg.package_id} value={pkg.package_id} disabled={unconfigured}>
            {packageLabel(pkg)}
            {unconfigured ? ' — not ready for new players' : ''}
          </option>
        )
      })}
    </SelectField>
  )
}
