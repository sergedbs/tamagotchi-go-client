import { ClientConfigError } from './config.ts'

export function ConfigErrorScreen({ error }: { error: unknown }) {
  const issues = error instanceof ClientConfigError ? error.issues : []
  const message = error instanceof Error ? error.message : 'Configuration could not be loaded.'
  return (
    <main className="config-error">
      <h1>Tamagotchi Go cannot start</h1>
      <p>{message}</p>
      {issues.length > 0 && (
        <ul>
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      <p>Fix the public runtime configuration and reload. No source change is required.</p>
    </main>
  )
}
