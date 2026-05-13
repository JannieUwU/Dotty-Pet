export interface VSCodeCheckResult {
  available: boolean
  strategy: 'cli' | 'app-fallback' | 'unavailable'
  version?: string
  message: string
}

export type VSCodeItemType = 'file' | 'folder'

export interface VSCodeItem {
  path: string
  type: VSCodeItemType
}

export interface VSCodeRecentItem extends VSCodeItem {
  openedAt: number
}

export interface VSCodeBridgeApi {
  getProjectRoot: () => Promise<string>
  openPath: (targetPath?: string) => Promise<VSCodeItem>
  selectFolder: () => Promise<string | null>
  selectItem: () => Promise<VSCodeItem | null>
  revealPath: (targetPath?: string) => Promise<VSCodeItem>
  createFile: () => Promise<VSCodeItem | null>
  createProject: (projectName: string) => Promise<VSCodeItem | null>
  check: () => Promise<VSCodeCheckResult>
}
