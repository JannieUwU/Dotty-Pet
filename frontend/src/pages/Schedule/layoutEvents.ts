import { CalendarEvent } from '../../store/scheduleStore'

export interface LayoutEvent {
  ev: CalendarEvent
  slot: number      // 0-based column index within the day
  totalCols: number // how many columns the overlap group needs (max 3)
  top: number       // px from top
  height: number    // px
}

function toMin(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * Given a list of events for one day and a px-per-hour value,
 * returns layout metadata for each event so they render side-by-side
 * when they overlap. Max 3 columns; a 4th+ overlapping event still
 * gets capped at slot 2 (it will visually stack behind col-2 events).
 */
export function layoutEvents(events: CalendarEvent[], pxPerHour: number): LayoutEvent[] {
  if (events.length === 0) return []

  // Build interval list sorted by start, then by end descending
  const items = events.map(ev => {
    const start = toMin(ev.startTime || '0:00')
    const end   = toMin(ev.endTime   || '0:00')
    return { ev, start, end: end > start ? end : start + 30 }
  }).sort((a, b) => a.start - b.start || b.end - a.end)

  const MAX_COLS = 3
  // slots[i] = end-minute of the last event placed in slot i
  const slots: number[] = []

  const placed: { ev: CalendarEvent; slot: number; start: number; end: number }[] = []

  for (const item of items) {
    // Find the first free slot (no overlap)
    let chosen = -1
    for (let s = 0; s < Math.min(slots.length, MAX_COLS); s++) {
      if (slots[s] <= item.start) { chosen = s; break }
    }
    if (chosen === -1 && slots.length < MAX_COLS) {
      chosen = slots.length
    }
    if (chosen === -1) chosen = MAX_COLS - 1 // cap at last slot

    slots[chosen] = item.end
    placed.push({ ev: item.ev, slot: chosen, start: item.start, end: item.end })
  }

  // Union-Find: group all transitively-overlapping events together so
  // every event in a connected overlap cluster shares the same totalCols.
  const parent = placed.map((_, i) => i)
  function find(i: number): number {
    if (parent[i] !== i) parent[i] = find(parent[i])
    return parent[i]
  }
  function union(i: number, j: number) {
    parent[find(i)] = find(j)
  }

  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i], b = placed[j]
      if (!(b.end <= a.start || b.start >= a.end)) {
        union(i, j)
      }
    }
  }

  // For each root, find the max slot used in that group.
  const groupMaxSlot: Record<number, number> = {}
  placed.forEach((p, i) => {
    const root = find(i)
    groupMaxSlot[root] = Math.max(groupMaxSlot[root] ?? 0, p.slot)
  })

  const result: LayoutEvent[] = placed.map((p, i) => {
    const totalCols = Math.min(groupMaxSlot[find(i)] + 1, MAX_COLS)

    const startH = p.start / 60
    const endH   = p.end   / 60
    const top    = startH * pxPerHour
    const height = Math.max((endH - startH) * pxPerHour, 20)

    return { ev: p.ev, slot: p.slot, totalCols, top, height }
  })

  return result
}
