import { create } from 'zustand'
import type { VSCodeCheckResult, VSCodeItem, VSCodeRecentItem } from '../types/vscode'
import { scopedStorageKey, subscribeAccountScopeChanged } from '../utils/accountScope'

const RECENT_ITEMS_KEY = 'vscode-command-palette-recent-items'
const MAX_RECENT_ITEMS = 3

const isRecentItem = (value: unknown): value is VSCodeRecentItem => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<VSCodeRecentItem>
  return (
    typeof candidate.path === 'string' &&
    (candidate.type === 'file' || candidate.type === 'folder') &&
    typeof candidate.openedAt === 'number'
  )
}

const readRecentItems = (): VSCodeRecentItem[] => {
  if (typeof window === 'undefined') return []
  try {
    const rawValue = window.localStorage.getItem(scopedStorageKey(RECENT_ITEMS_KEY))
    if (!rawValue) return []
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed.filter(isRecentItem).slice(0, MAX_RECENT_ITEMS) : []
  } catch {
    return []
  }
}

const saveRecentItems = (items: VSCodeRecentItem[]) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(scopedStorageKey(RECENT_ITEMS_KEY), JSON.stringify(items))
}

const getVSCodeBridge = () => {
  if (!window.vscodeBridge) {
    throw new Error('VS Code bridge is only available inside Electron.')
  }
  return window.vscodeBridge
}

interface VSCodeState {
  isOpen: boolean
  activeIndex: number
  busy: boolean
  projectRoot: string | null
  recentItems: VSCodeRecentItem[]
  revealedItem: VSCodeItem | null
  status: string | null
  error: string | null
  checkResult: VSCodeCheckResult | null
  openPalette: () => Promise<void>
  closePalette: () => void
  setActiveIndex: (value: number) => void
  moveActive: (delta: number, itemCount: number) => void
  openPath: (targetPath?: string) => Promise<void>
  revealLocalItem: () => Promise<void>
  createFile: () => Promise<void>
  createProject: (projectName: string) => Promise<boolean>
  checkVSCode: () => Promise<void>
  clearMessage: () => void
}

const addRecentItem = (items: VSCodeRecentItem[], item: VSCodeItem): VSCodeRecentItem[] =>
  [
    { ...item, openedAt: Date.now() },
    ...items.filter((e) => e.path !== item.path),
  ].slice(0, MAX_RECENT_ITEMS)

export const useVSCodeStore = create<VSCodeState>((set, get) => ({
  isOpen: false,
  activeIndex: 0,
  busy: false,
  projectRoot: null,
  recentItems: readRecentItems(),
  revealedItem: null,
  status: null,
  error: null,
  checkResult: null,

  openPalette: async () => {
    set({ isOpen: true, activeIndex: 0, status: null, error: null })
    if (get().projectRoot) return
    if (!window.vscodeBridge) {
      // Running in browser dev mode — palette still opens, just no project root
      return
    }
    try {
      const projectRoot = await getVSCodeBridge().getProjectRoot()
      set({ projectRoot })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to read the current project path.' })
    }
  },

  closePalette: () => set({ isOpen: false, activeIndex: 0, status: null, error: null }),

  setActiveIndex: (value) => set({ activeIndex: value }),

  moveActive: (delta, itemCount) => {
    if (itemCount <= 0) return
    set((state) => ({ activeIndex: (state.activeIndex + delta + itemCount) % itemCount }))
  },

  openPath: async (targetPath) => {
    set({ busy: true, error: null, status: null })
    try {
      const openedItem = await getVSCodeBridge().openPath(targetPath)
      const recentItems = addRecentItem(get().recentItems, openedItem)
      saveRecentItems(recentItems)
      set({ busy: false, recentItems, status: `Opened in VS Code: ${openedItem.path.split(/[\\/]/).pop()}`, isOpen: true })
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : 'Unable to open VS Code.' })
    }
  },

  revealLocalItem: async () => {
    set({ busy: true, error: null, status: null, revealedItem: null })
    try {
      const selectedItem = await getVSCodeBridge().selectItem()
      if (!selectedItem) { set({ busy: false }); return }
      const openedItem = await getVSCodeBridge().openPath(selectedItem.path)
      const recentItems = addRecentItem(get().recentItems, openedItem)
      saveRecentItems(recentItems)
      set({ busy: false, recentItems, revealedItem: null, status: null, isOpen: true })
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : 'Unable to open the selected item.' })
    }
  },

  createFile: async () => {
    set({ busy: true, error: null, status: null })
    try {
      const createdItem = await getVSCodeBridge().createFile()
      if (!createdItem) { set({ busy: false }); return }
      const recentItems = addRecentItem(get().recentItems, createdItem)
      saveRecentItems(recentItems)
      set({ busy: false, recentItems, status: `Created: ${createdItem.path.split(/[\\/]/).pop()}`, isOpen: true })
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : 'Unable to create a new file.' })
    }
  },

  createProject: async (projectName) => {
    set({ busy: true, error: null, status: null })
    try {
      const createdItem = await getVSCodeBridge().createProject(projectName)
      if (!createdItem) { set({ busy: false }); return false }
      const recentItems = addRecentItem(get().recentItems, createdItem)
      saveRecentItems(recentItems)
      set({ busy: false, recentItems, status: `Project created: ${createdItem.path.split(/[\\/]/).pop()}`, isOpen: true })
      return true
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : 'Unable to create a new project.' })
      return false
    }
  },

  checkVSCode: async () => {
    set({ busy: true, error: null, status: null })
    try {
      const checkResult = await getVSCodeBridge().check()
      set({ busy: false, checkResult, status: checkResult.message })
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : 'Unable to check VS Code.' })
    }
  },

  clearMessage: () => set({ status: null, error: null }),
}))

subscribeAccountScopeChanged(() => {
  useVSCodeStore.setState({
    activeIndex: 0,
    recentItems: readRecentItems(),
    revealedItem: null,
    status: null,
    error: null,
  })
})
