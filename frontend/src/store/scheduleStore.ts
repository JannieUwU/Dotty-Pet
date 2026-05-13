import { create } from 'zustand'
import { subscribeAccountScopeChanged } from '../utils/accountScope'
import { apiFetch } from '../utils/api'

export type EventColor = '#83B5B5' | '#F9CE9C' | '#C1D09D' | '#BFC5D5'

export interface CalendarEvent {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  color: EventColor
  description: string
  isCountdown: boolean
}

export interface MonthlyGoal {
  id: string
  yearMonth: string
  text: string
  completed: boolean
}

export interface Habit {
  id: string
  name: string
  icon: string
  time: string
  days: number[]
  color?: string
  reminder: boolean
  reminderTime?: string
}

// ── helpers ──────────────────────────────────────────────────────────────────

function eventFromApi(e: any): CalendarEvent {
  return {
    id: String(e.id),
    title: e.title,
    date: e.date,
    startTime: e.start_time ?? '',
    endTime: e.end_time ?? '',
    color: e.color as EventColor,
    description: e.description ?? '',
    isCountdown: Boolean(e.has_countdown),
  }
}

function habitFromApi(h: any): Habit {
  const rawDays: string = h.days ?? ''
  const days = rawDays
    .split(',')
    .map(Number)
    .filter((n: number) => !isNaN(n) && n >= 0 && n <= 6)
  return {
    id: String(h.id),
    name: h.name,
    icon: h.icon,
    color: h.color,
    time: h.remind_time ?? '',
    days,
    reminder: Boolean(h.remind_time),
    reminderTime: h.remind_time ?? undefined,
  }
}

function goalFromApi(g: any): MonthlyGoal {
  return { id: String(g.id), yearMonth: g.year_month ?? '', text: g.text, completed: Boolean(g.completed) }
}

// ── store ─────────────────────────────────────────────────────────────────────

const HABIT_COLORS = ['#83B5B5','#F9CE9C','#C1D09D','#BFC5D5','#9BB8AF','#AEC8A3','#8F9CB3','#E8BFB3','#F3D8C8','#D4CDC0']

interface ScheduleState {
  todayStr: string
  setTodayStr: (s: string) => void
  events: CalendarEvent[]
  goals: MonthlyGoal[]
  habits: Habit[]
  checkedHabits: Record<string, string[]>
  taskCount: number
  taskTotal: number
  habitCount: number
  habitTotal: number
  doneTaskIds: string[]

  // loaders
  loadEvents: (month?: string) => Promise<void>
  loadGoals: (month: string) => Promise<void>
  loadHabits: () => Promise<void>
  loadChecks: (from: string, to: string) => Promise<void>

  // mutations
  addEvent: (event: Omit<CalendarEvent, 'id'>) => Promise<void>
  updateEvent: (id: string, event: Omit<CalendarEvent, 'id'>) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  addGoal: (text: string, yearMonth: string) => Promise<void>
  toggleGoal: (id: string) => Promise<void>
  editGoal: (id: string, text: string) => Promise<void>
  deleteGoal: (id: string) => Promise<void>
  addHabit: (habit: Omit<Habit, 'id' | 'color'> & { color?: string }) => Promise<void>
  updateHabit: (id: string, days: number[], reminderTime?: string, time?: string) => Promise<void>
  deleteHabit: (id: string) => Promise<void>
  checkHabit: (id: string, date: string) => Promise<void>
  uncheckHabit: (id: string, date: string) => Promise<void>
  toggleTaskDone: (id: string) => void
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  todayStr: new Date().toISOString().slice(0, 10),
  setTodayStr: (s) => set({ todayStr: s }),
  events: [],
  goals: [],
  habits: [],
  checkedHabits: {},
  taskCount: 0,
  taskTotal: 0,
  habitCount: 0,
  habitTotal: 0,
  doneTaskIds: [],

  toggleTaskDone: (id) => set((s) => ({
    doneTaskIds: s.doneTaskIds.includes(id) ? s.doneTaskIds.filter(x => x !== id) : [...s.doneTaskIds, id]
  })),

  // ── loaders (read-only, retry on transient failures) ──────────────────────

  loadEvents: async (month) => {
    try {
      const url = month ? `/events/?month=${month}` : `/events/`
      const res = await apiFetch(url)
      const data = await res.json()
      set({ events: data.map(eventFromApi) })
    } catch (err) {
      console.error('[scheduleStore] loadEvents failed:', err)
    }
  },

  loadGoals: async (month) => {
    try {
      const res = await apiFetch(`/goals/?month=${month}`)
      const data = await res.json()
      set({ goals: data.map(goalFromApi) })
    } catch (err) {
      console.error('[scheduleStore] loadGoals failed:', err)
    }
  },

  loadHabits: async () => {
    try {
      const res = await apiFetch(`/habits/`)
      const data = await res.json()
      set({ habits: data.map(habitFromApi) })
    } catch (err) {
      console.error('[scheduleStore] loadHabits failed:', err)
    }
  },

  loadChecks: async (from, to) => {
    try {
      const res = await apiFetch(`/habits/checks?from_date=${from}&to_date=${to}`)
      const data: { habit_id: number; check_date: string }[] = await res.json()
      const map: Record<string, string[]> = {}
      for (const c of data) {
        const key = String(c.habit_id)
        if (!map[key]) map[key] = []
        map[key].push(c.check_date)
      }
      set({ checkedHabits: map })
    } catch (err) {
      console.error('[scheduleStore] loadChecks failed:', err)
    }
  },

  // ── mutations (user-initiated writes, single attempt + error propagation) ──
  // Mutations use fetchWithRetry with retries=1 so the user gets immediate
  // feedback on failure rather than waiting for back-off delays.

  addEvent: async (event) => {
    const res = await apiFetch(`/events/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: event.title, date: event.date,
        start_time: event.startTime || null, end_time: event.endTime || null,
        color: event.color, has_countdown: event.isCountdown,
        description: event.description,
      }),
    }, 1)
    const data = await res.json()
    set((s) => ({ events: [...s.events, eventFromApi(data)] }))
  },

  updateEvent: async (id, event) => {
    const res = await apiFetch(`/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: event.title, date: event.date,
        start_time: event.startTime || null, end_time: event.endTime || null,
        color: event.color, has_countdown: event.isCountdown,
        description: event.description,
      }),
    }, 1)
    const data = await res.json()
    set((s) => ({ events: s.events.map(e => e.id === id ? eventFromApi(data) : e) }))
  },

  deleteEvent: async (id) => {
    await apiFetch(`/events/${id}`, { method: 'DELETE' }, 1)
    set((s) => ({ events: s.events.filter(e => e.id !== id) }))
  },

  addGoal: async (text, yearMonth) => {
    const res = await apiFetch(`/goals/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year_month: yearMonth, text }),
    }, 1)
    const data = await res.json()
    set((s) => ({ goals: [...s.goals, goalFromApi(data)] }))
  },

  toggleGoal: async (id) => {
    const res = await apiFetch(`/goals/${id}/toggle`, { method: 'PATCH' }, 1)
    const data = await res.json()
    set((s) => ({ goals: s.goals.map(g => g.id === id ? goalFromApi(data) : g) }))
  },

  editGoal: async (id, text) => {
    const goal = get().goals.find(g => g.id === id)
    if (!goal) return
    const res = await apiFetch(`/goals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year_month: goal.yearMonth || new Date().toISOString().slice(0,7), text, completed: goal.completed }),
    }, 1)
    const data = await res.json()
    set((s) => ({ goals: s.goals.map(g => g.id === id ? goalFromApi(data) : g) }))
  },

  deleteGoal: async (id) => {
    await apiFetch(`/goals/${id}`, { method: 'DELETE' }, 1)
    set((s) => ({ goals: s.goals.filter(g => g.id !== id) }))
  },

  addHabit: async (habit) => {
    const color = habit.color || HABIT_COLORS[get().habits.length % HABIT_COLORS.length]
    const res = await apiFetch(`/habits/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: habit.name, icon: habit.icon, color,
        remind_time: habit.reminderTime ?? null,
        days: habit.days.length > 0 ? habit.days.join(',') : '0,1,2,3,4,5,6',
      }),
    }, 1)
    const data = await res.json()
    const newHabit = habitFromApi(data)
    set((s) => ({
      habits: [...s.habits, newHabit],
      checkedHabits: { ...s.checkedHabits, [newHabit.id]: [] },
    }))
  },

  updateHabit: async (id, days, reminderTime, time) => {
    const res = await apiFetch(`/habits/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        days: days.length > 0 ? days.join(',') : '0,1,2,3,4,5,6',
        remind_time: reminderTime ?? null,
        time: time ?? null,
      }),
    }, 1)
    const data = await res.json()
    set((s) => ({ habits: s.habits.map(h => h.id === id ? habitFromApi(data) : h) }))
  },

  deleteHabit: async (id) => {
    await apiFetch(`/habits/${id}`, { method: 'DELETE' }, 1)
    set((s) => {
      const { [id]: _, ...rest } = s.checkedHabits
      return { habits: s.habits.filter(h => h.id !== id), checkedHabits: rest }
    })
  },

  checkHabit: async (id, date) => {
    await apiFetch(`/habits/${id}/check?date=${date}`, { method: 'POST' }, 1)
    set((s) => ({
      checkedHabits: {
        ...s.checkedHabits,
        [id]: [...(s.checkedHabits[id] ?? []).filter(d => d !== date), date],
      }
    }))
  },

  uncheckHabit: async (id, date) => {
    await apiFetch(`/habits/${id}/check?date=${date}`, { method: 'DELETE' }, 1)
    set((s) => ({
      checkedHabits: {
        ...s.checkedHabits,
        [id]: (s.checkedHabits[id] ?? []).filter(d => d !== date),
      }
    }))
  },
}))

// ── Account scope subscription ────────────────────────────────────────────────
// Reload all data when the active account changes (login / logout / switch).
// The unsubscribe function is kept so tests or HMR can clean up if needed.
export const _unsubScheduleScope = subscribeAccountScopeChanged(() => {
  const store = useScheduleStore.getState()
  const today = new Date().toISOString().slice(0, 10)
  const month = today.slice(0, 7)
  store.loadEvents(month)
  store.loadGoals(month)
  store.loadHabits()
  store.loadChecks(today, today)
})
