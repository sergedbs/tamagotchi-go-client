import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { describeApiError, isApiError, type ApiError } from '../../api/errors.ts'
import { apiPath } from '../../api/http.ts'
import { useCommand } from '../../api/useCommand.ts'
import { applyCreatureState, creatureKeys } from './api.ts'
import { careReceiptSchema, type CareReceipt } from './dto.ts'
import { careChanges, type CareStatus, type CreatureView } from './view.ts'

export function careFailure(error: ApiError | Error, action: string, name: string): CareStatus {
  if (isApiError(error)) {
    if (error.code === 'action_on_cooldown') return { kind: 'cooldown', action, retryAfterSeconds: error.retryAfterSeconds }
    if (error.code === 'creature_engaged') {
      return { kind: 'failed', action, message: `${name} is busy in a battle or raid right now.`, correlationId: error.correlationId, uncertain: false }
    }
    if (error.code === 'command_in_progress') {
      return { kind: 'failed', action, message: 'The server is still processing this action.', correlationId: error.correlationId, uncertain: true }
    }
    if (error.uncertain) {
      return {
        kind: 'failed',
        action,
        message: `${describeApiError(error)} It may or may not have been applied.`,
        correlationId: error.correlationId,
        uncertain: true,
      }
    }
    return { kind: 'failed', action, message: describeApiError(error), correlationId: error.correlationId, uncertain: false }
  }
  return { kind: 'failed', action, message: describeApiError(error), correlationId: null, uncertain: false }
}

/**
 * Care for one creature. The returned creature is authoritative; currency stays
 * pending and the wallet is refreshed rather than adjusted locally.
 */
export function useCare(userId: string, view: CreatureView) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<CareStatus>({ kind: 'idle' })
  const [celebrate, setCelebrate] = useState(0)
  const before = useRef(view)
  const actionOf = (body: unknown) => (body as { action: string }).action

  const command = useCommand<CareReceipt>({
    onSuccess: (response, sent) => {
      const next = response.data.tamagotchi
      setStatus({ kind: 'done', action: actionOf(sent.body), changes: careChanges(before.current, next) })
      applyCreatureState(queryClient, userId, next)
      void queryClient.invalidateQueries({ queryKey: creatureKeys.creature(userId, next.id) })
      void queryClient.invalidateQueries({ queryKey: ['user', userId, 'wallet'] })
      setCelebrate((count) => count + 1)
    },
    onError: (error, sent) => setStatus(careFailure(error, actionOf(sent.body), view.creature.name)),
  })

  return {
    status: command.pending && command.command ? ({ kind: 'pending', action: actionOf(command.command.body) } as const) : status,
    celebrate,
    care: (action: string) => {
      if (command.pending) return
      before.current = view
      command.start({
        method: 'POST',
        path: apiPath`/tamagotchi/v1/tamagotchis/${view.creature.id}/care`,
        body: { action },
        idempotent: true,
        parse: (value) => careReceiptSchema.parse(value) as CareReceipt,
        actor: userId,
      })
    },
    retry: () => {
      if (command.pending) return
      command.retry()
    },
  }
}
