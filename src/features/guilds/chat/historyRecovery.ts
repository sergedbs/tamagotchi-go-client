import type { ChatMessage } from './protocol.ts'

type Page = { items: ChatMessage[]; next_cursor: string | null }

/** Scan newest-first pages back to the last completed sync, not a newer live frame. */
export async function recoverHistory(
  fetchPage: (cursor: string | null) => Promise<Page>,
  boundary: string | null,
): Promise<{ items: ChatMessage[]; boundary: string | null }> {
  const items: ChatMessage[] = []
  const cursors = new Set<string>()
  let cursor: string | null = null
  for (let page = 0; page < 20; page += 1) {
    const result = await fetchPage(cursor)
    items.push(...result.items)
    if (boundary === null || result.items.some((item) => item.message_id === boundary) || !result.next_cursor) {
      return { items, boundary: items[0]?.message_id ?? boundary }
    }
    if (cursors.has(result.next_cursor)) throw new Error('Chat history repeated a cursor.')
    cursors.add(result.next_cursor)
    cursor = result.next_cursor
  }
  throw new Error('Chat catch-up exceeded its page limit. Older messages remain available in history.')
}
