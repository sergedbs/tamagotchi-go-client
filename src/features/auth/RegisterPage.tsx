import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { z } from 'zod'
import { describeApiError, isApiError } from '../../api/errors.ts'
import { useCommand } from '../../api/useCommand.ts'
import { Button } from '../../components/Button.tsx'
import { FormAlert } from '../../components/FormAlert.tsx'
import { TextField } from '../../components/Field.tsx'
import { registrationSchema, type Registration } from './dto.ts'
import { PackageSelect } from './LoginPage.tsx'
import { canOnboard, usePublicPackages } from './packagesApi.ts'
import { useSession, useSessionStore } from './sessionContext.ts'
import styles from './AuthForms.module.css'

const registerForm = z.object({
  username: z.string().trim().min(3, 'Use at least 3 characters.').max(32, 'Use at most 32 characters.'),
  email: z.email('Enter a valid email address.').max(254),
  password: z.string().min(12, 'Use at least 12 characters.').max(128, 'Use at most 128 characters.'),
  package_id: z.string().min(1, 'Choose a package to start in.'),
})
type RegisterForm = z.input<typeof registerForm>

export default function RegisterPage() {
  const session = useSession()
  const store = useSessionStore()
  const navigate = useNavigate()
  const packages = usePublicPackages()
  const [form, setForm] = useState<RegisterForm>({ username: '', email: '', password: '', package_id: '' })
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof RegisterForm, string>>>({})
  const [phase, setPhase] = useState<'form' | 'signing-in'>('form')
  const [signInError, setSignInError] = useState<unknown>(null)

  const register = useCommand<Registration>({
    onSuccess: async (_response, command) => {
      const body = command.body as RegisterForm
      setPhase('signing-in')
      try {
        await store.login({ email: body.email, password: body.password, packageId: body.package_id })
        navigate('/creatures', { replace: true, state: { onboarding: true } })
      } catch (error) {
        setSignInError(error)
        setPhase('form')
      }
    },
  })

  if (session.status === 'authenticated' && phase === 'form') return <Navigate to="/creatures" replace />

  const offered = packages.data?.items.filter((pkg) => pkg.status === 'active') ?? []
  const ready = offered.filter(canOnboard)

  const update = (patch: Partial<RegisterForm>) => {
    setForm((current) => ({ ...current, ...patch }))
    // Changed input is a new intention: never replay an earlier key with different data.
    if (register.command && !register.pending) register.reset()
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = registerForm.safeParse(form)
    if (!parsed.success) {
      const errors: Partial<Record<keyof RegisterForm, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof RegisterForm
        errors[key] ??= issue.message
      }
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setSignInError(null)
    register.start({
      method: 'POST',
      path: '/users/v1/users/register',
      auth: 'public',
      idempotent: true,
      body: parsed.data,
      parse: (value) => registrationSchema.parse(value),
      actor: null,
    })
  }

  if (signInError !== null) {
    return (
      <div className={styles.form}>
        <div className={styles.heading}>
          <h1>Account created</h1>
          <p>Signing in did not complete, but your account exists.</p>
        </div>
        <FormAlert title="Sign in to continue." correlationId={isApiError(signInError) ? signInError.correlationId : null}>
          {describeApiError(signInError)}
        </FormAlert>
        <Button variant="primary" onClick={() => navigate('/login', { state: { email: form.email, packageId: form.package_id } })}>
          Go to sign in
        </Button>
      </div>
    )
  }

  const error = register.error
  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-labelledby="register-title">
      <div className={styles.heading}>
        <h1 id="register-title">Meet your first companion</h1>
        <p>Create an account and your package&rsquo;s starter will hatch for you.</p>
      </div>
      {error && (
        <FormAlert
          title={register.uncertain ? 'We could not confirm your account was created.' : 'Account not created.'}
          correlationId={isApiError(error) ? error.correlationId : null}
        >
          <p>{describeApiError(error)}</p>
          {register.uncertain && (
            <p className={styles.retryRow}>
              Retrying sends the exact same request, so it cannot create a second account.{' '}
              <button type="button" className={styles.inlineRetry} onClick={register.retry}>
                Retry same request
              </button>
            </p>
          )}
        </FormAlert>
      )}
      {phase === 'signing-in' && <FormAlert title="Account created. Signing you in…" tone="info" />}
      <PackageSelect
        value={form.package_id}
        onChange={(value) => update({ package_id: value })}
        packages={offered}
        loading={packages.isPending}
        failed={packages.isError}
        onRetry={() => void packages.refetch()}
        error={fieldErrors.package_id}
        disableUnconfigured
        hint={
          packages.data && ready.length === 0
            ? 'No package is ready for new players yet.'
            : 'Your starter creature comes from this package.'
        }
      />
      <TextField
        label="Username"
        autoComplete="username"
        value={form.username}
        onChange={(event) => update({ username: event.target.value })}
        error={fieldErrors.username}
        hint="3–32 characters, shown to other players."
        maxLength={32}
        required
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={form.email}
        onChange={(event) => update({ email: event.target.value })}
        error={fieldErrors.email}
        required
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="new-password"
        value={form.password}
        onChange={(event) => update({ password: event.target.value })}
        error={fieldErrors.password}
        hint="At least 12 characters."
        maxLength={128}
        required
      />
      <Button type="submit" variant="primary" block busy={register.pending || phase === 'signing-in'}>
        Create account
      </Button>
      <p className={styles.switch}>
        Already playing? <Link to="/login">Sign in</Link>
      </p>
    </form>
  )
}
