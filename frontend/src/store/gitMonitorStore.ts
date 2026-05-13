import { create } from 'zustand'
import type { GitFileDiff, GitRepoSummary } from '../types/git'
import { scopedStorageKey } from '../utils/accountScope'

const STORAGE_KEY = 'git-monitor-repo-path'

const readSavedRepoPath = () =>
  typeof window === 'undefined' ? null : window.localStorage.getItem(scopedStorageKey(STORAGE_KEY))

const saveRepoPath = (repoPath: string) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(scopedStorageKey(STORAGE_KEY), repoPath)
  }
}

interface GitMonitorState {
  isOpen: boolean
  loading: boolean
  diffLoading: boolean
  committing: boolean
  repoPath: string | null
  summary: GitRepoSummary | null
  diff: GitFileDiff | null
  selectedDiffPath: string | null
  commitMessage: string
  fileActionTarget: string | null
  fileActionKind: 'open' | 'stage' | 'unstage' | null
  error: string | null
  openPanel: () => void
  closePanel: () => void
  selectRepository: () => Promise<void>
  refresh: (repoPath?: string) => Promise<void>
  viewDiff: (filePath: string) => Promise<void>
  clearDiff: () => void
  openFile: (filePath: string) => Promise<void>
  stageFile: (filePath: string) => Promise<void>
  unstageFile: (filePath: string) => Promise<void>
  setCommitMessage: (value: string) => void
  commit: () => Promise<void>
}

const getGitApi = () => {
  if (!window.gitMonitor) {
    throw new Error('Git API not available in this environment.')
  }

  return window.gitMonitor
}

const reconcileDiffState = (
  summary: GitRepoSummary,
  selectedDiffPath: string | null,
  currentDiff: GitFileDiff | null,
) => {
  if (!selectedDiffPath) {
    return {
      diff: currentDiff,
      selectedDiffPath,
    }
  }

  const fileStillExists = summary.files.some((file) => file.path === selectedDiffPath)
  if (fileStillExists) {
    return {
      diff: currentDiff,
      selectedDiffPath,
    }
  }

  return {
    diff: null,
    selectedDiffPath: null,
  }
}

export const useGitMonitorStore = create<GitMonitorState>((set, get) => ({
  isOpen: false,
  loading: false,
  diffLoading: false,
  committing: false,
  repoPath: readSavedRepoPath(),
  summary: null,
  diff: null,
  selectedDiffPath: null,
  commitMessage: '',
  fileActionTarget: null,
  fileActionKind: null,
  error: null,

  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),

  selectRepository: async () => {
    try {
      const repoPath = await getGitApi().selectRepository()
      if (!repoPath) return

      saveRepoPath(repoPath)
      set({
        repoPath,
        error: null,
        diff: null,
        selectedDiffPath: null,
        commitMessage: '',
      })
      await get().refresh(repoPath)
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to select repository',
      })
    }
  },

  refresh: async (incomingRepoPath) => {
    const repoPath = incomingRepoPath ?? get().repoPath ?? readSavedRepoPath()

    if (!repoPath) {
      set({ summary: null, error: 'Please select a Git repository first.' })
      return
    }

    set({ loading: true, error: null })

    try {
      const summary = await getGitApi().getRepositoryStatus(repoPath)
      saveRepoPath(repoPath)
      const diffState = reconcileDiffState(
        summary,
        get().selectedDiffPath,
        get().diff,
      )

      set({ repoPath, summary, loading: false })

      if (diffState.selectedDiffPath !== get().selectedDiffPath) {
        set({
          diff: diffState.diff,
          selectedDiffPath: diffState.selectedDiffPath,
        })
      }
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load repository status',
      })
    }
  },

  viewDiff: async (filePath) => {
    const repoPath = get().repoPath ?? readSavedRepoPath()

    if (!repoPath) {
      set({ error: 'Please select a Git repository first.' })
      return
    }

    set({
      diffLoading: true,
      selectedDiffPath: filePath,
      diff: null,
      error: null,
    })

    try {
      const diff = await getGitApi().getFileDiff(repoPath, filePath)
      set({
        diff,
        diffLoading: false,
        selectedDiffPath: filePath,
      })
    } catch (error) {
      set({
        diffLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load diff',
      })
    }
  },

  clearDiff: () => set({
    diff: null,
    diffLoading: false,
    selectedDiffPath: null,
  }),

  openFile: async (filePath) => {
    const repoPath = get().repoPath ?? readSavedRepoPath()

    if (!repoPath) {
      set({ error: 'Please select a Git repository first.' })
      return
    }

    set({
      fileActionTarget: filePath,
      fileActionKind: 'open',
      error: null,
    })

    try {
      await getGitApi().openFile(repoPath, filePath)
      set({ fileActionTarget: null, fileActionKind: null })
    } catch (error) {
      set({
        fileActionTarget: null,
        fileActionKind: null,
        error: error instanceof Error ? error.message : 'Failed to open file',
      })
    }
  },

  stageFile: async (filePath) => {
    const repoPath = get().repoPath ?? readSavedRepoPath()

    if (!repoPath) {
      set({ error: 'Please select a Git repository first.' })
      return
    }

    set({
      fileActionTarget: filePath,
      fileActionKind: 'stage',
      error: null,
    })

    try {
      const summary = await getGitApi().stageFile(repoPath, filePath)
      const shouldRefreshDiff =
        get().selectedDiffPath === filePath &&
        summary.files.some((file) => file.path === filePath)

      set({
        summary,
        fileActionTarget: null,
        fileActionKind: null,
        ...reconcileDiffState(summary, get().selectedDiffPath, get().diff),
      })

      if (shouldRefreshDiff) {
        await get().viewDiff(filePath)
      }
    } catch (error) {
      set({
        fileActionTarget: null,
        fileActionKind: null,
        error: error instanceof Error ? error.message : 'Failed to stage file',
      })
    }
  },

  unstageFile: async (filePath) => {
    const repoPath = get().repoPath ?? readSavedRepoPath()

    if (!repoPath) {
      set({ error: 'Please select a Git repository first.' })
      return
    }

    set({
      fileActionTarget: filePath,
      fileActionKind: 'unstage',
      error: null,
    })

    try {
      const summary = await getGitApi().unstageFile(repoPath, filePath)
      const shouldRefreshDiff =
        get().selectedDiffPath === filePath &&
        summary.files.some((file) => file.path === filePath)

      set({
        summary,
        fileActionTarget: null,
        fileActionKind: null,
        ...reconcileDiffState(summary, get().selectedDiffPath, get().diff),
      })

      if (shouldRefreshDiff) {
        await get().viewDiff(filePath)
      }
    } catch (error) {
      set({
        fileActionTarget: null,
        fileActionKind: null,
        error: error instanceof Error ? error.message : 'Failed to unstage file',
      })
    }
  },

  setCommitMessage: (value) => set({ commitMessage: value }),

  commit: async () => {
    const repoPath = get().repoPath ?? readSavedRepoPath()

    if (!repoPath) {
      set({ error: 'Please select a Git repository first.' })
      return
    }

    set({ committing: true, error: null })

    try {
      const summary = await getGitApi().commit(repoPath, get().commitMessage)
      set({
        summary,
        commitMessage: '',
        committing: false,
        diff: null,
        selectedDiffPath: null,
      })
    } catch (error) {
      set({
        committing: false,
        error: error instanceof Error ? error.message : 'Commit failed',
      })
    }
  },
}))
