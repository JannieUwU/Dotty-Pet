import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  minimize:       () => ipcRenderer.send('window-minimize'),
  close:          () => ipcRenderer.send('window-close'),
  openTaskManager: () => ipcRenderer.send('open-task-manager'),
  onClipboardPaste: (cb: (text: string) => void) => {
    ipcRenderer.removeAllListeners('clipboard-paste')
    ipcRenderer.on('clipboard-paste', (_e, text: string) => cb(text))
  },
  checkUnity:     () => ipcRenderer.invoke('unity-check'),
  launchUnity:    () => ipcRenderer.invoke('unity-launch'),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  loadVrmModel:   (filePath: string) => ipcRenderer.invoke('load-vrm-model', filePath),
  resetVrmModel:  () => ipcRenderer.invoke('reset-vrm-model'),
  // pet context menu
  menuNavigate:   (page: string) => ipcRenderer.send('menu-navigate', page),
  menuClose:      () => ipcRenderer.send('menu-close'),
  onMenuReset:    (cb: () => void) => {
    ipcRenderer.removeAllListeners('menu-reset')
    ipcRenderer.on('menu-reset', () => cb())
  },
  onNavigate:     (cb: (page: string) => void) => {
    ipcRenderer.removeAllListeners('navigate')
    ipcRenderer.on('navigate', (_e, page) => cb(page))
  },
  // pet chat window
  chatOpen:       () => ipcRenderer.send('chat-open'),
  chatClose:      () => ipcRenderer.send('chat-close'),
  confirmEvent:   (data: object) => ipcRenderer.send('chat-confirm-event', data),
  onEventConfirmed: (cb: (data: object) => void) => {
    ipcRenderer.removeAllListeners('chat-event-confirmed')
    ipcRenderer.on('chat-event-confirmed', (_e, data) => cb(data))
  },
  // pet bubble notifications
  petNotify: (message: string, emotion: string) => ipcRenderer.send('pet-notify', { message, emotion }),
  // chat streaming
  chatStreamStart: (payload: object) => ipcRenderer.send('chat-stream-start', payload),
  onChatChunk:  (cb: (line: string) => void) => {
    ipcRenderer.removeAllListeners('chat-stream-chunk')
    ipcRenderer.on('chat-stream-chunk', (_e, line) => cb(line))
  },
  onChatEnd:    (cb: () => void) => {
    ipcRenderer.removeAllListeners('chat-stream-end')
    ipcRenderer.on('chat-stream-end', () => cb())
  },
  onChatError:  (cb: (msg: string) => void) => {
    ipcRenderer.removeAllListeners('chat-stream-error')
    ipcRenderer.on('chat-stream-error', (_e, msg) => cb(msg))
  },
  // auth flow — renderer notifies main process of login/logout
  notifyLoginSuccess: () => ipcRenderer.send('auth:login-success'),
  notifyLogout:       () => ipcRenderer.send('auth:logout-ready'),
  writeAuthSession:   (userJson: string) => ipcRenderer.send('auth:write-session', userJson),
  clearAuthSession:   () => ipcRenderer.send('auth:clear-session'),
  // set by main process so renderer knows which window it is
  isLoginWindow: ipcRenderer.sendSync('auth:is-login-window') as boolean,
  // backend readiness — renderer invokes this once it's mounted to get current
  // backend status. Main process replies immediately with the current state so
  // there's no race between "backend ready" and "renderer registered listener".
  getBackendStatus: () => ipcRenderer.invoke('backend:get-status') as Promise<'ready' | 'error' | 'pending'>,
  // Push channel: main process also sends these if backend resolves AFTER the
  // renderer has already called getBackendStatus and got 'pending'.
  onBackendReady: (cb: () => void) => {
    ipcRenderer.removeAllListeners('backend:ready')
    ipcRenderer.on('backend:ready', () => cb())
  },
  onBackendError: (cb: (msg: string) => void) => {
    ipcRenderer.removeAllListeners('backend:error')
    ipcRenderer.on('backend:error', (_e, msg) => cb(msg))
  },
})

// Git monitor API — exposed as window.gitMonitor
contextBridge.exposeInMainWorld('gitMonitor', {
  selectRepository:    () => ipcRenderer.invoke('git-monitor:select-repository'),
  getRepositoryStatus: (repoPath: string) => ipcRenderer.invoke('git-monitor:get-status', repoPath),
  getFileDiff:         (repoPath: string, filePath: string) => ipcRenderer.invoke('git-monitor:get-file-diff', repoPath, filePath),
  openFile:            (repoPath: string, filePath: string) => ipcRenderer.invoke('git-monitor:open-file', repoPath, filePath),
  stageFile:           (repoPath: string, filePath: string) => ipcRenderer.invoke('git-monitor:stage-file', repoPath, filePath),
  unstageFile:         (repoPath: string, filePath: string) => ipcRenderer.invoke('git-monitor:unstage-file', repoPath, filePath),
  commit:              (repoPath: string, message: string) => ipcRenderer.invoke('git-monitor:commit', repoPath, message),
})

// VS Code bridge — exposed as window.vscodeBridge
contextBridge.exposeInMainWorld('vscodeBridge', {
  getProjectRoot: () => ipcRenderer.invoke('vscode:get-project-root'),
  openPath: (targetPath?: string) => ipcRenderer.invoke('vscode:open-path', targetPath),
  selectFolder: () => ipcRenderer.invoke('vscode:select-folder'),
  selectItem: () => ipcRenderer.invoke('vscode:select-item'),
  revealPath: (targetPath?: string) => ipcRenderer.invoke('vscode:reveal-path', targetPath),
  createFile: () => ipcRenderer.invoke('vscode:create-file'),
  createProject: (projectName: string) => ipcRenderer.invoke('vscode:create-project', projectName),
  check: () => ipcRenderer.invoke('vscode:check'),
})

