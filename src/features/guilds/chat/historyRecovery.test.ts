import { describe, expect, it, vi } from 'vitest'
import { recoverHistory } from './historyRecovery.ts'
import type { ChatMessage } from './protocol.ts'
const message = (id: string) => ({ message_id: id } as ChatMessage)

describe('chat history recovery', () => {
  it('starts with the latest page and establishes a sync boundary', async () => {
    const fetch = vi.fn().mockResolvedValue({ items: [message('3')], next_cursor: 'older' })
    expect(await recoverHistory(fetch, null)).toEqual({ items: [message('3')], boundary: '3' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('recovers multiple pages despite already receiving newer live messages', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ items: [message('5'), message('4')], next_cursor: 'second' })
      .mockResolvedValueOnce({ items: [message('3'), message('2')], next_cursor: 'third' })
    const result = await recoverHistory(fetch, '2')
    expect(result.items.map((m) => m.message_id)).toEqual(['5', '4', '3', '2'])
    expect(result.boundary).toBe('5')
    expect(fetch).toHaveBeenNthCalledWith(2, 'second')
  })
  it('ends at exhausted history when the old boundary is unavailable', async () => {
    expect((await recoverHistory(async () => ({ items: [], next_cursor: null }), 'old')).boundary).toBe('old')
  })
  it('reports broken pagination and preserves failures for the caller', async () => {
    await expect(recoverHistory(async () => ({ items: [], next_cursor: 'same' }), 'old')).rejects.toThrow('repeated')
    let page = 0
    await expect(recoverHistory(async () => ({ items: [], next_cursor: String(++page) }), 'old')).rejects.toThrow('page limit')
    await expect(recoverHistory(async () => { throw new Error('unavailable') }, 'old')).rejects.toThrow('unavailable')
  })
})
