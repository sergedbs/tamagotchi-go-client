export interface Target {
  name: string
  gateway: string
  public_client_origin: string
  test_target: boolean
}

export interface CliOptions {
  mode: 'preflight' | 'provision'
  target: Target
  runId: string | null
  confirmed: boolean
  writeClientConfig: boolean
}

export class UsageError extends Error {}

const MODES = ['preflight', 'provision', 'scenario', 'refresh-locations'] as const

/** Parses argv; refuses unknown targets, missing confirmation and unimplemented modes. */
export function parseArgs(argv: string[], targets: Record<string, Omit<Target, 'name'>>): CliOptions {
  const [mode, ...rest] = argv
  if (!mode || !MODES.includes(mode as (typeof MODES)[number])) {
    throw new UsageError(`Usage: npm run fixtures -- <${MODES.join('|')}> --target <name> [--run-id <id>] [--confirm-test-target <name>]`)
  }
  if (mode === 'scenario' || mode === 'refresh-locations') {
    throw new UsageError(`Mode "${mode}" is not implemented in this build yet.`)
  }
  const flags = new Map<string, string | true>()
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index]!
    if (!arg.startsWith('--')) throw new UsageError(`Unexpected argument: ${arg}`)
    const next = rest[index + 1]
    if (next && !next.startsWith('--')) {
      flags.set(arg.slice(2), next)
      index++
    } else {
      flags.set(arg.slice(2), true)
    }
  }
  const targetName = flags.get('target')
  if (typeof targetName !== 'string') throw new UsageError('--target is required.')
  const target = targets[targetName]
  if (!target) throw new UsageError(`Unknown target "${targetName}". Known: ${Object.keys(targets).join(', ') || 'none'}.`)
  if (!target.test_target) throw new UsageError(`Target "${targetName}" is not marked as a test target; refusing.`)

  const runId = flags.get('run-id')
  const confirm = flags.get('confirm-test-target')
  if (mode === 'provision') {
    if (typeof runId !== 'string' || !/^[a-z0-9][a-z0-9-]{1,11}$/.test(runId)) {
      throw new UsageError('--run-id is required for provision: 2-12 lowercase letters, digits or dashes.')
    }
    if (confirm !== targetName) throw new UsageError(`--confirm-test-target ${targetName} is required for provision.`)
  }
  return {
    mode: mode as CliOptions['mode'],
    target: { name: targetName, ...target },
    runId: typeof runId === 'string' ? runId : null,
    confirmed: confirm === targetName,
    writeClientConfig: flags.get('write-client-config') === true,
  }
}
