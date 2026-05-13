import type { GitMonitorApi } from './git'
import type { VSCodeBridgeApi } from './vscode'

export interface ElectronApi {
  minimize?: () => void
  close?: () => void
  openTaskManager?: () => void
  onClipboardPaste?: (cb: (text: string) => void) => void
  checkUnity?: () => Promise<{ online: boolean; hasExe: boolean }>
  launchUnity?: () => Promise<{ ok: boolean; reason?: string }>
  openFileDialog?: () => Promise<string | null>
  loadVrmModel?: (filePath: string) => Promise<{ ok: boolean; name?: string; reason?: string }>
  resetVrmModel?: () => Promise<{ ok: boolean; unityReached: boolean }>
  menuNavigate?: (page: string) => void
  menuClose?: () => void
  onMenuReset?: (cb: () => void) => void
  onNavigate?: (cb: (page: string) => void) => void
  chatOpen?: () => void
  chatClose?: () => void
  confirmEvent?: (data: object) => void
  onEventConfirmed?: (cb: (data: object) => void) => void
  chatStreamStart?: (payload: object) => void
  onChatChunk?: (cb: (line: string) => void) => void
  onChatEnd?: (cb: () => void) => void
  onChatError?: (cb: (msg: string) => void) => void
  petNotify?: (message: string, emotion: string) => void
  // auth IPC
  notifyLoginSuccess?: () => void
  notifyLogout?: () => void
  writeAuthSession?: (userJson: string) => void
  clearAuthSession?: () => void
  isLoginWindow?: boolean
  // backend readiness IPC
  getBackendStatus?: () => Promise<'ready' | 'error' | 'pending'>
  onBackendReady?: (cb: () => void) => void
  onBackendError?: (cb: (msg: string) => void) => void
}

declare global {
  interface Window {
    gitMonitor?: GitMonitorApi
    vscodeBridge?: VSCodeBridgeApi
    electron?: ElectronApi
  }
}
