/**
 * Explicit fixture CLI. Talks to a named test target through Gateway APIs only;
 * never runs on app startup, never prints credentials.
 *
 *   npm run fixtures -- preflight --target local-acceptance
 *   npm run fixtures -- provision --target local-acceptance --run-id demo1 --confirm-test-target local-acceptance
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs, UsageError, type Target } from './fixtures/args.ts'
import { preflight, provision, type Io } from './fixtures/run.ts'

const root = process.cwd()
const targets = JSON.parse(readFileSync(join(root, 'fixtures', 'targets.json'), 'utf8')) as Record<string, Omit<Target, 'name'>>
const personas = JSON.parse(readFileSync(join(root, 'fixtures', 'personas.json'), 'utf8')) as { key: string; package: string }[]
const io: Io = {
  fetch,
  log: (line) => console.log(line),
  root,
  now: () => new Date(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}

try {
  const options = parseArgs(process.argv.slice(2), targets)
  const report = options.mode === 'preflight' ? await preflight(options, io) : await provision(options, io, personas)
  if ('ok' in report && !report.ok) process.exitCode = 1
} catch (error) {
  console.error(error instanceof UsageError ? error.message : `Stopped: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = error instanceof UsageError ? 2 : 1
}
