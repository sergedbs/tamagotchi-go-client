import { afterEach, describe, expect, it, vi } from 'vitest'
import { listenForeground } from './push.ts'
import type { PushConfig } from '../../app/config.ts'

const firebase = vi.hoisted(() => ({
  onMessage: vi.fn(),
  getMessaging: vi.fn(() => ({})),
}))
vi.mock('firebase/app', () => ({ getApps: () => [{}], initializeApp: vi.fn() }))
vi.mock('firebase/messaging', () => firebase)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('foreground push', () => {
  it.each([false, true])('refreshes the inbox and requests a banner, even when display fails (%s)', async (failDisplay) => {
    const showNotification = vi.fn(() => failDisplay ? Promise.reject(new Error('OS refused')) : Promise.resolve())
    vi.stubGlobal('navigator', {
      serviceWorker: { register: vi.fn().mockResolvedValue({ active: {}, showNotification }) },
    })
    const stop = vi.fn()
    firebase.onMessage.mockReturnValue(stop)
    const refreshInbox = vi.fn()
    const unsubscribe = await listenForeground({ firebase: {}, vapid_key: 'test' } as PushConfig, refreshInbox)
    const receive = firebase.onMessage.mock.calls[0]![1] as (payload: unknown) => void
    receive({ data: {
      type: 'FRIEND_REQUEST',
      notification_id: '01a15000-0000-7000-8000-00000000a001',
      params: JSON.stringify({ from_username: 'mira' }),
    } })
    await Promise.resolve()
    expect(refreshInbox).toHaveBeenCalledOnce()
    expect(showNotification).toHaveBeenCalledWith('mira wants to be friends', expect.objectContaining({
      tag: '01a15000-0000-7000-8000-00000000a001',
      data: { href: '/social' },
    }))
    unsubscribe()
    expect(stop).toHaveBeenCalledOnce()
  })
})
