import { useCallback, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useApi } from './apiContext.ts'
import { commandRequest, createCommand, type Command, type CommandSpec } from './command.ts'
import { isApiError, type ApiError } from './errors.ts'
import type { ApiResponse } from './http.ts'

export interface CommandState<T> {
  pending: boolean
  /** The last command sent; kept so an uncertain outcome can be replayed exactly. */
  command: Command<T> | null
  data: ApiResponse<T> | null
  error: ApiError | Error | null
  /** The last failure may have committed on the server. */
  uncertain: boolean
}

/**
 * Runs logical mutations. start() snapshots a new command (new key); retry()
 * re-sends the exact last command. Duplicate submits are ignored while pending.
 */
export function useCommand<T>(callbacks: {
  onSuccess?: (response: ApiResponse<T>, command: Command<T>) => void
  onError?: (error: ApiError | Error, command: Command<T>) => void
} = {}) {
  const api = useApi()
  const [command, setCommand] = useState<Command<T> | null>(null)
  const inFlight = useRef(false)

  const mutation = useMutation<ApiResponse<T>, ApiError | Error, Command<T>>({
    mutationFn: (next) => api.request(commandRequest(next)),
    retry: false,
    onSuccess: (response, sent) => callbacks.onSuccess?.(response, sent),
    onError: (error, sent) => callbacks.onError?.(error, sent),
    onSettled: () => {
      inFlight.current = false
    },
  })

  const send = useCallback(
    (next: Command<T>) => {
      if (inFlight.current) return
      inFlight.current = true
      setCommand(next)
      mutation.mutate(next)
    },
    [mutation],
  )

  const start = useCallback((spec: CommandSpec<T>) => send(createCommand(spec)), [send])
  const retry = useCallback(() => {
    if (command) send(command)
  }, [command, send])
  const reset = useCallback(() => {
    mutation.reset()
    setCommand(null)
  }, [mutation])

  const error = mutation.error
  const state: CommandState<T> = {
    pending: mutation.isPending,
    command,
    data: mutation.data ?? null,
    error,
    uncertain: isApiError(error) ? error.uncertain : false,
  }
  return { ...state, start, retry, reset }
}
