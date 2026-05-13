import { create } from 'zustand'

export type NavPage = 'dashboard' | 'desktop-pet' | 'schedule' | 'pomodoro' | 'resource-library' | 'setting' | 'quick-start'

export interface RecentFeature {
  id: string
  title: string
  detail: string
  page: Exclude<NavPage, 'dashboard'>
  usedAt: number
}

interface ScheduleFocusTarget {
  date: string
  view: 'Daily' | 'Monthly'
}

interface AppState {
  currentPage: NavPage
  recentFeatures: RecentFeature[]
  scheduleFocusTarget: ScheduleFocusTarget | null
  setPage: (page: NavPage, options?: { recordRecent?: boolean }) => void
  goToScheduleDate: (date: string, view?: 'Daily' | 'Monthly') => void
  clearScheduleFocusTarget: () => void
}

const PAGE_TITLES: Record<Exclude<NavPage, 'dashboard'>, string> = {
  'desktop-pet': 'Desktop Pet',
  schedule: 'Schedule',
  pomodoro: 'Pomodoro Timer',
  'resource-library': 'Resource Library',
  setting: 'Setting',
  'quick-start': 'Quick Start',
}

const PAGE_DETAILS: Record<Exclude<NavPage, 'dashboard'>, string> = {
  'desktop-pet': 'Checked pet controls and quick actions',
  schedule: 'Reviewed upcoming events and countdown tasks',
  pomodoro: 'Continued a focus session',
  'resource-library': 'Browsed recent folders and files',
  setting: 'Adjusted app preferences',
  'quick-start': 'Opened the onboarding guide',
}

const pushRecent = (list: RecentFeature[], item: RecentFeature) =>
  [item, ...list.filter((entry) => entry.page !== item.page)].slice(0, 3)

const recordRecentForPage = (list: RecentFeature[], page: NavPage, now: number, recordRecent = true) => {
  if (!recordRecent || page === 'dashboard') return list
  return pushRecent(list, {
    id: `nav-${page}`,
    title: PAGE_TITLES[page],
    detail: PAGE_DETAILS[page],
    page,
    usedAt: now,
  })
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'schedule',
  scheduleFocusTarget: null,
  recentFeatures: [
    { id: 'schedule', title: 'Schedule', detail: 'Reviewed upcoming events and countdown tasks', page: 'schedule', usedAt: Date.now() - 12 * 60 * 1000 },
    { id: 'pomodoro', title: 'Pomodoro Timer', detail: 'Continued a focus session', page: 'pomodoro', usedAt: Date.now() - 38 * 60 * 1000 },
    { id: 'quick-start', title: 'Quick Start', detail: 'Opened the onboarding guide', page: 'quick-start', usedAt: Date.now() - 2 * 60 * 60 * 1000 },
  ],
  setPage: (page, options) =>
    set((state) => ({
      currentPage: page,
      recentFeatures: recordRecentForPage(state.recentFeatures, page, Date.now(), options?.recordRecent ?? true),
    })),
  goToScheduleDate: (date, view = 'Daily') =>
    set((state) => ({
      currentPage: 'schedule',
      scheduleFocusTarget: { date, view },
      recentFeatures: recordRecentForPage(state.recentFeatures, 'schedule', Date.now(), true),
    })),
  clearScheduleFocusTarget: () => set({ scheduleFocusTarget: null }),
}))
