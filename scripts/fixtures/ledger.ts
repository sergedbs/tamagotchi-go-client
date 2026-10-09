import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { v7 as uuidv7 } from 'uuid'

/** One mutation, persisted before it is sent so a lost reply can be resumed. */
export interface Step {
  id: string
  method: string
  path: string
  body: unknown
  key: string | null
  status: 'pending' | 'done' | 'failed'
  result?: unknown
  error?: { status: number | null; code: string | null; correlation_id: string | null }
}

export interface LedgerData {
  target: string
  run_id: string
  created_at: string
  steps: Record<string, Step>
  /** Private generated credentials; never printed. */
  secrets: Record<string, { email: string; password: string }>
  facts: Record<string, unknown>
}

/** Private, resumable run ledger under .local/ (ignored by Git), written atomically. */
export class Ledger {
  readonly file: string
  data: LedgerData

  constructor(file: string, target: string, runId: string) {
    this.file = file
    this.data = existsSync(file)
      ? (JSON.parse(readFileSync(file, 'utf8')) as LedgerData)
      : { target, run_id: runId, created_at: new Date().toISOString(), steps: {}, secrets: {}, facts: {} }
    if (this.data.target !== target || this.data.run_id !== runId) throw new Error('Ledger belongs to a different target or run.')
  }

  save() {
    mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 })
    const temp = `${this.file}.tmp`
    writeFileSync(temp, JSON.stringify(this.data, null, 2), { mode: 0o600 })
    renameSync(temp, this.file)
  }

  /**
   * Returns the saved step, or plans a new one with a fresh key. A planned step
   * keeps its exact body and key across resumes; it is never re-keyed.
   */
  plan(id: string, method: string, path: string, body: unknown, idempotent: boolean): Step {
    const existing = this.data.steps[id]
    if (existing) {
      if (existing.method !== method || existing.path !== path) throw new Error(`Step ${id} was saved with a different request.`)
      return existing
    }
    const step: Step = { id, method, path, body: structuredClone(body), key: idempotent ? uuidv7() : null, status: 'pending' }
    this.data.steps[id] = step
    this.save()
    return step
  }

  complete(id: string, result: unknown) {
    const step = this.data.steps[id]
    if (!step) throw new Error(`Unknown step ${id}`)
    step.status = 'done'
    step.result = result
    delete step.error
    this.save()
  }

  fail(id: string, error: Step['error']) {
    const step = this.data.steps[id]
    if (!step) throw new Error(`Unknown step ${id}`)
    step.status = 'failed'
    step.error = error
    this.save()
  }
}
