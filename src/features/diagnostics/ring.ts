import type { Activity } from '../../api/activity.ts'

export const RING_CAPACITY = 100

/** In-memory, bounded and never persisted: the newest 100 transport attempts. */
export class ActivityRing {
  private items: Activity[] = []
  private readonly listeners = new Set<() => void>()
  private readonly capacity: number

  constructor(capacity = RING_CAPACITY) {
    this.capacity = capacity
  }

  record = (activity: Activity) => {
    this.items = [activity, ...this.items].slice(0, this.capacity)
    for (const listener of this.listeners) listener()
  }

  clear = () => {
    this.items = []
    for (const listener of this.listeners) listener()
  }

  /** Newest first; a new array after every change. */
  snapshot = (): readonly Activity[] => this.items

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
