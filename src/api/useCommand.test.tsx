import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { ApiContext, useApi } from './apiContext.ts'
import type { ApiClient, ApiResponse } from './http.ts'
import { ApiError } from './errors.ts'
import { useCommand } from './useCommand.ts'

const spec = { method: 'POST' as const, path: '/guild/v1/guilds', body: { name: 'Fixture' }, actor: 'user', idempotent: true }
const response: ApiResponse<unknown> = { data: { accepted: true }, status: 201, etag: null, correlationId: null }
function wrapper(request: ApiClient['request']) {
  const query = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const client: ApiClient = { request }
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={query}><ApiContext value={client}>{children}</ApiContext></QueryClientProvider>
  )
}

describe('command hook', () => {
  it('ignores duplicate pending submits and clears completed state on reset', async () => {
    let complete!: (value: ApiResponse<unknown>) => void
    const request = vi.fn(() => new Promise<ApiResponse<unknown>>((resolve) => { complete = resolve }))
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useCommand({ onSuccess }), { wrapper: wrapper(request as ApiClient['request']) })
    act(() => { result.current.retry() })
    expect(request).not.toHaveBeenCalled()
    act(() => { result.current.start(spec); result.current.start(spec) })
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    await act(async () => { complete(response) })
    await waitFor(() => expect(result.current.data).toEqual(response))
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(result.current.pending).toBe(false)
    act(() => result.current.reset())
    expect(result.current.command).toBeNull()
    await waitFor(() => expect(result.current.data).toBeNull())
  })

  it('never auto-retries uncertain writes and explicitly retries the same key and body', async () => {
    const failure = new ApiError({ kind: 'network', message: 'Lost reply', method: 'POST', route: spec.path })
    const request = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce(response)
    const onError = vi.fn()
    const { result } = renderHook(() => useCommand({ onError }), { wrapper: wrapper(request) })
    act(() => result.current.start(spec))
    await waitFor(() => expect(result.current.uncertain).toBe(true))
    expect(onError).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledTimes(1)
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.data).toEqual(response))
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[1]?.[0]).toEqual(request.mock.calls[0]?.[0])
    expect(result.current.uncertain).toBe(false)
  })

  it('refuses an API hook without the application provider', () => {
    expect(() => renderHook(() => useApi())).toThrow('inside ApiContext')
  })
})
