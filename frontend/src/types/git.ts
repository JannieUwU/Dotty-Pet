export type GitFileState =
  | 'staged'
  | 'modified'
  | 'untracked'
  | 'deleted'
  | 'renamed'
  | 'conflicted'

export interface GitChangedFile {
  path: string
  state: GitFileState
  indexStatus: string
  workingTreeStatus: string
}

export interface GitRepoSummary {
  repoPath: string
  repoName: string
  branch: string
  isDirty: boolean
  ahead: number
  behind: number
  stagedCount: number
  modifiedCount: number
  untrackedCount: number
  lastCommitMessage: string
  lastCommitAuthor: string
  lastCommitAt: string
  scannedAt: string
  files: GitChangedFile[]
}

export interface GitDiffSection {
  label: string
  diff: string
}

export interface GitFileDiff {
  path: string
  sections: GitDiffSection[]
}

export interface GitMonitorApi {
  selectRepository: () => Promise<string | null>
  getRepositoryStatus: (repoPath: string) => Promise<GitRepoSummary>
  getFileDiff: (repoPath: string, filePath: string) => Promise<GitFileDiff>
  openFile: (repoPath: string, filePath: string) => Promise<void>
  stageFile: (repoPath: string, filePath: string) => Promise<GitRepoSummary>
  unstageFile: (repoPath: string, filePath: string) => Promise<GitRepoSummary>
  commit: (repoPath: string, message: string) => Promise<GitRepoSummary>
}
