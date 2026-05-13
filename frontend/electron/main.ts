import { app, BrowserWindow, ipcMain, dialog, screen, shell, Menu, clipboard } from 'electron'
import { spawn, ChildProcess, execFile } from 'child_process'
import { promisify } from 'util'
import type { ExecFileException } from 'child_process'
import path from 'path'
import fs from 'fs'
import http from 'http'
import { uIOhook, UiohookMouseEvent } from 'uiohook-napi'

const isDev = !app.isPackaged
let isQuitting = false

// ── Git monitor helpers ────────────────────────────────────────────────────

const execFileAsync = promisify(execFile)

type GitFileState = 'staged' | 'modified' | 'untracked' | 'deleted' | 'renamed' | 'conflicted'
interface GitChangedFile { path: string; state: GitFileState; indexStatus: string; workingTreeStatus: string }
interface GitRepoSummary { repoPath: string; repoName: string; branch: string; isDirty: boolean; ahead: number; behind: number; stagedCount: number; modifiedCount: number; untrackedCount: number; lastCommitMessage: string; lastCommitAuthor: string; lastCommitAt: string; scannedAt: string; files: GitChangedFile[] }
interface GitDiffSection { label: string; diff: string }
interface GitFileDiff { path: string; sections: GitDiffSection[] }

const getGitErrorMessage = (error: unknown) => {
  const e = error as ExecFileException & { stdout?: string; stderr?: string }
  return e.stderr?.trim() || e.stdout?.trim() || e.message || 'Git command failed'
}

const runGit = async (args: string[], cwd: string, allowedExitCodes: number[] = [0]) => {
  try {
    // shell: true ensures git is found on Windows even when not in Electron's PATH
    const { stdout } = await execFileAsync('git', args, { cwd, encoding: 'utf8', shell: true })
    return stdout
  } catch (error) {
    const e = error as ExecFileException & { code?: number; stdout?: string }
    if (typeof e.code === 'number' && allowedExitCodes.includes(e.code)) return e.stdout ?? ''
    throw new Error(getGitErrorMessage(error))
  }
}

const ensureGitRepo = (repoPath: string) => {
  if (!fs.existsSync(path.join(repoPath, '.git'))) throw new Error('Selected directory is not a Git repository')
}

const resolveRepoFilePath = (repoPath: string, filePath: string) => {
  const abs = path.resolve(repoPath, filePath)
  const rel = path.relative(repoPath, abs)
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Invalid file path')
  return abs
}

const parseBranchHeader = (headerLine: string) => {
  const raw = headerLine.replace(/^## /, '')
  const ahead = Number(raw.match(/ahead (\d+)/)?.[1] ?? 0)
  const behind = Number(raw.match(/behind (\d+)/)?.[1] ?? 0)
  let branch = 'DETACHED'
  if (raw.startsWith('No commits yet on ')) branch = raw.replace('No commits yet on ', '').trim()
  else if (!raw.startsWith('HEAD (no branch)')) branch = raw.split('...')[0].split(' ')[0]
  return { branch, ahead, behind }
}

const getFileState = (i: string, w: string): GitFileState => {
  if (i === '?' && w === '?') return 'untracked'
  if (i === 'U' || w === 'U') return 'conflicted'
  if (i === 'D' || w === 'D') return 'deleted'
  if (i === 'R' || w === 'R') return 'renamed'
  if (i !== ' ') return 'staged'
  return 'modified'
}

const parseChangedFiles = (lines: string[]) => {
  let stagedCount = 0, modifiedCount = 0, untrackedCount = 0
  const files: GitChangedFile[] = lines.filter(Boolean).map(line => {
    if (line.startsWith('??')) { untrackedCount++; return { path: line.slice(3).trim(), state: 'untracked' as GitFileState, indexStatus: '?', workingTreeStatus: '?' } }
    const i = line[0], w = line[1]
    let filePath = line.slice(3).trim()
    if (filePath.includes(' -> ')) filePath = filePath.split(' -> ').pop()!
    if (i !== ' ') stagedCount++
    if (w !== ' ') modifiedCount++
    return { path: filePath, state: getFileState(i, w), indexStatus: i, workingTreeStatus: w }
  })
  return { files, stagedCount, modifiedCount, untrackedCount }
}

const getRepositoryStatus = async (repoPath: string): Promise<GitRepoSummary> => {
  ensureGitRepo(repoPath)
  const statusText = (await runGit(['status', '--porcelain=v1', '--branch'], repoPath)).trimEnd()
  const logText = await runGit(['log', '-1', '--pretty=format:%s%n%an%n%ai'], repoPath).catch(() => '')
  const lines = statusText.split(/\r?\n/)
  const { branch, ahead, behind } = parseBranchHeader(lines[0] || '## HEAD (no branch)')
  const { files, stagedCount, modifiedCount, untrackedCount } = parseChangedFiles(lines.slice(1))
  const [lastCommitMessage = '', lastCommitAuthor = '', lastCommitAt = ''] = logText.split(/\r?\n/)
  return { repoPath, repoName: path.basename(repoPath), branch, isDirty: files.length > 0, ahead, behind, stagedCount, modifiedCount, untrackedCount, lastCommitMessage, lastCommitAuthor, lastCommitAt, scannedAt: new Date().toISOString(), files }
}

const getFileDiff = async (repoPath: string, filePath: string): Promise<GitFileDiff> => {
  ensureGitRepo(repoPath)
  const absPath = resolveRepoFilePath(repoPath, filePath)
  const statusLine = (await runGit(['status', '--porcelain=v1', '--', filePath], repoPath)).trim().split(/\r?\n/).find(Boolean)
  let i = ' ', w = ' '
  if (statusLine?.startsWith('??')) { i = '?'; w = '?' } else if (statusLine) { i = statusLine[0]; w = statusLine[1] }
  const sections: GitDiffSection[] = []
  if (i === '?' && w === '?') {
    if (!fs.existsSync(absPath)) throw new Error('File does not exist, cannot view diff')
    // Git for Windows understands /dev/null; use forward-slash path for the file too
    const gitPath = absPath.replace(/\\/g, '/')
    const diff = await runGit(['diff', '--no-index', '--', '/dev/null', gitPath], repoPath, [0, 1])
    if (diff.trim()) sections.push({ label: 'Untracked', diff: diff.trimEnd() })
  } else {
    if (i !== ' ') { const d = await runGit(['diff', '--cached', '--', filePath], repoPath, [0, 1]); if (d.trim()) sections.push({ label: 'Staged', diff: d.trimEnd() }) }
    if (w !== ' ') { const d = await runGit(['diff', '--', filePath], repoPath, [0, 1]); if (d.trim()) sections.push({ label: 'Working Tree', diff: d.trimEnd() }) }
  }
  if (sections.length === 0) sections.push({ label: 'Info', diff: 'No textual diff available for this file.' })
  return { path: filePath, sections }
}

const openInVSCode = async (absPath: string) => {
  try { await execFileAsync('code', ['-g', absPath], { encoding: 'utf8', shell: true }); return } catch {}
  const normalized = process.platform === 'win32' ? absPath.replace(/\\/g, '/') : absPath
  await shell.openExternal(`vscode://file/${encodeURI(normalized)}`)
}

// ── Git IPC handlers ───────────────────────────────────────────────────────

ipcMain.handle('git-monitor:select-repository', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled || result.filePaths.length === 0) return null
  const repoPath = result.filePaths[0]
  ensureGitRepo(repoPath)
  return repoPath
})

ipcMain.handle('git-monitor:get-status', async (_e, repoPath: string) => getRepositoryStatus(repoPath))

ipcMain.handle('git-monitor:get-file-diff', async (_e, repoPath: string, filePath: string) => getFileDiff(repoPath, filePath))

ipcMain.handle('git-monitor:open-file', async (_e, repoPath: string, filePath: string) => {
  ensureGitRepo(repoPath)
  const absPath = resolveRepoFilePath(repoPath, filePath)
  if (!fs.existsSync(absPath)) throw new Error('File does not exist, cannot open')
  await openInVSCode(absPath)
})

ipcMain.handle('git-monitor:stage-file', async (_e, repoPath: string, filePath: string) => {
  ensureGitRepo(repoPath); resolveRepoFilePath(repoPath, filePath)
  await runGit(['add', '--', filePath], repoPath)
  return getRepositoryStatus(repoPath)
})

ipcMain.handle('git-monitor:unstage-file', async (_e, repoPath: string, filePath: string) => {
  ensureGitRepo(repoPath); resolveRepoFilePath(repoPath, filePath)
  try { await runGit(['restore', '--staged', '--', filePath], repoPath) } catch { await runGit(['rm', '--cached', '--', filePath], repoPath) }
  return getRepositoryStatus(repoPath)
})

ipcMain.handle('git-monitor:commit', async (_e, repoPath: string, message: string) => {
  ensureGitRepo(repoPath)
  const msg = message.trim()
  if (!msg) throw new Error('Commit message cannot be empty')
  // Check if git user config is set; if not, use a fallback so commit doesn't fail
  const userName = (await runGit(['config', 'user.name'], repoPath).catch(() => '')).trim()
  const userEmail = (await runGit(['config', 'user.email'], repoPath).catch(() => '')).trim()
  const extraArgs: string[] = []
  if (!userName) extraArgs.push('-c', 'user.name=DottyPet')
  if (!userEmail) extraArgs.push('-c', 'user.email=dotty@local')
  await runGit([...extraArgs, 'commit', '-m', msg], repoPath)
  return getRepositoryStatus(repoPath)
})

// ── VS Code helpers ────────────────────────────────────────────────────────

interface VSCodeCheckResult {
  available: boolean
  strategy: 'cli' | 'app-fallback' | 'unavailable'
  version?: string
  message: string
}

type VSCodeItemType = 'file' | 'folder'
interface VSCodeItem { path: string; type: VSCodeItemType }

const toVSCodeItem = (absolutePath: string): VSCodeItem => {
  const stats = fs.statSync(absolutePath)
  return { path: absolutePath, type: stats.isDirectory() ? 'folder' : 'file' }
}

const launchDetached = (command: string, args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true })
    child.once('spawn', () => { child.unref(); resolve() })
    child.once('error', reject)
  })

const confirmReplace = async (message: string, detail: string) => {
  const result = await dialog.showMessageBox({ type: 'warning', buttons: ['Replace', 'Cancel'], defaultId: 1, cancelId: 1, title: 'Replace existing item?', message, detail, noLink: true })
  return result.response === 0
}

const openInVSCodeFull = async (absPath: string, options: { gotoFile?: boolean } = {}) => {
  try { await launchDetached('code', options.gotoFile ? ['-g', absPath] : [absPath]); return } catch {}
  if (process.platform === 'darwin') {
    try { await launchDetached('open', ['-a', 'Visual Studio Code', absPath]); return } catch {}
  }
  const normalized = process.platform === 'win32' ? absPath.replace(/\\/g, '/') : absPath
  await shell.openExternal(`vscode://file/${encodeURI(normalized)}`)
}

const checkVSCodeAvailability = async (): Promise<VSCodeCheckResult> => {
  try {
    const { stdout } = await execFileAsync('code', ['--version'], { encoding: 'utf8', shell: true })
    const version = stdout.split(/\r?\n/).find(Boolean)
    return { available: true, strategy: 'cli', version, message: 'VS Code CLI ready.' }
  } catch {}
  return { available: false, strategy: 'unavailable', message: 'VS Code not found.' }
}

const openPathInVSCode = async (targetPath?: string) => {
  const absolutePath = targetPath ? path.resolve(targetPath) : path.resolve(__dirname, '../..')
  if (!fs.existsSync(absolutePath)) throw new Error('Path does not exist.')
  const item = toVSCodeItem(absolutePath)
  await openInVSCodeFull(absolutePath, { gotoFile: item.type === 'file' })
  return item
}

const selectItemForVSCode = async () => {
  const result = await dialog.showOpenDialog({ properties: ['openFile', 'openDirectory'] })
  if (result.canceled || result.filePaths.length === 0) return null
  return toVSCodeItem(result.filePaths[0])
}

const createFileForVSCode = async () => {
  const result = await dialog.showSaveDialog({ title: 'Create New File', buttonLabel: 'Create' })
  if (result.canceled || !result.filePath) return null
  const filePath = path.resolve(result.filePath)
  if (fs.existsSync(filePath)) {
    if (fs.statSync(filePath).isDirectory()) throw new Error('A folder already exists at this path.')
    const shouldReplace = await confirmReplace('A file with this name already exists.', `${filePath}\n\nReplacing it will overwrite the existing file with an empty file.`)
    if (!shouldReplace) return null
  }
  fs.writeFileSync(filePath, '')
  await openInVSCodeFull(filePath, { gotoFile: true })
  return toVSCodeItem(filePath)
}

const createProjectForVSCode = async (projectName: string) => {
  const trimmedName = projectName.trim()
  if (!trimmedName) throw new Error('Project name is required.')
  if (/[\\/]/.test(trimmedName)) throw new Error('Project name cannot contain path separators.')
  const result = await dialog.showOpenDialog({ title: 'Choose Parent Folder', buttonLabel: 'Create Project Here', properties: ['openDirectory', 'createDirectory'] })
  if (result.canceled || result.filePaths.length === 0) return null
  const projectPath = path.join(result.filePaths[0], trimmedName)
  if (fs.existsSync(projectPath)) {
    if (!fs.statSync(projectPath).isDirectory()) throw new Error('A file already exists at this project path.')
    const shouldReplace = await confirmReplace('A project folder with this name already exists.', `${projectPath}\n\nReplacing it will delete the existing folder and create a new empty project.`)
    if (!shouldReplace) return null
    fs.rmSync(projectPath, { recursive: true, force: true })
  }
  fs.mkdirSync(projectPath)
  fs.writeFileSync(path.join(projectPath, 'README.md'), `# ${trimmedName}\n`)
  await openInVSCodeFull(projectPath)
  return toVSCodeItem(projectPath)
}

// ── VS Code IPC handlers ───────────────────────────────────────────────────

ipcMain.handle('vscode:get-project-root', () => path.resolve(__dirname, '../..'))
ipcMain.handle('vscode:open-path', async (_e, targetPath?: string) => openPathInVSCode(targetPath))
ipcMain.handle('vscode:select-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})
ipcMain.handle('vscode:select-item', async () => selectItemForVSCode())
ipcMain.handle('vscode:reveal-path', async (_e, targetPath?: string) => {
  const absolutePath = targetPath ? path.resolve(targetPath) : path.resolve(__dirname, '../..')
  if (!fs.existsSync(absolutePath)) throw new Error('Path does not exist.')
  shell.showItemInFolder(absolutePath)
  return toVSCodeItem(absolutePath)
})
ipcMain.handle('vscode:create-file', async () => createFileForVSCode())
ipcMain.handle('vscode:create-project', async (_e, projectName: string) => createProjectForVSCode(projectName))
ipcMain.handle('vscode:check', async () => checkVSCodeAvailability())

// ── Pet bubble notification ────────────────────────────────────────────────

const postToUnity = (unityPath: string, body: object) => {
  const data = JSON.stringify(body)
  const req = http.request(
    {
      hostname: '127.0.0.1', port: 8765, path: unityPath, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 800,
    },
    (res) => {
      // Must consume response body or the socket won't be released back to the pool
      res.resume()
      console.log(`[postToUnity] ${unityPath} → HTTP ${res.statusCode}`)
    }
  )
  req.on('timeout', () => { console.warn(`[postToUnity] ${unityPath} timed out`); req.destroy() })
  req.on('error', (e) => console.warn(`[postToUnity] ${unityPath} error: ${e.message}`))
  req.write(data)
  req.end()
}

// Notification queue: prevents rapid-fire messages from overwriting each other.
// Each entry waits for the previous bubble's display time before sending.
// Cap at 5 entries — if Unity isn't running, don't accumulate stale messages.
const BUBBLE_DISPLAY_MS = 6500 // matches BubbleHandler.displayDuration (6s) + fade (0.3s)
const NOTIFY_QUEUE_MAX = 5
let notifyQueue: Array<{ message: string; emotion: string }> = []
let notifyTimer: ReturnType<typeof setTimeout> | null = null

const flushNotifyQueue = () => {
  if (notifyQueue.length === 0) { notifyTimer = null; return }
  const { message, emotion } = notifyQueue.shift()!
  console.log(`[pet-notify] sending to Unity: "${message}"`)
  postToUnity('/notification', { message })
  if (emotion) postToUnity('/emotion', { state: emotion })
  notifyTimer = setTimeout(flushNotifyQueue, BUBBLE_DISPLAY_MS)
}

ipcMain.on('pet-notify', (_e, { message, emotion }: { message: string; emotion: string }) => {
  // Drop oldest entry if queue is full to prevent stale message buildup
  if (notifyQueue.length >= NOTIFY_QUEUE_MAX) {
    console.warn(`[pet-notify] queue full (${NOTIFY_QUEUE_MAX}), dropping oldest`)
    notifyQueue.shift()
  }
  console.log(`[pet-notify] message="${message}" emotion="${emotion}" queueLen=${notifyQueue.length}`)
  notifyQueue.push({ message, emotion })
  if (!notifyTimer) flushNotifyQueue()
})

let mainWindow: BrowserWindow | null = null
let menuWindow: BrowserWindow | null = null
let backendProcess: ChildProcess | null = null
let unityProcess: ChildProcess | null = null

// ── Process management ────────────────────────────────────────────────────────

/**
 * Kill a process tree by PID using taskkill /T /F.
 * Non-blocking: spawns taskkill detached so it never stalls the event loop.
 */
function killByPid(pid: number): void {
  try {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
      stdio: 'ignore', detached: true, windowsHide: true,
    }).unref()
  } catch {}
}

/**
 * Kill the backend and wait until port 8766 stops responding (max 4 s).
 * In dev mode the backend is managed by npm, not by Electron — skip the kill
 * but still wait briefly so the port is confirmed free before re-launch.
 */
function killBackend(): Promise<void> {
  // Kill our own child process if we own one
  if (backendProcess) {
    const pid = backendProcess.pid
    backendProcess.removeAllListeners()
    backendProcess = null
    if (pid) killByPid(pid)
  }

  // Wait until the port is no longer accepting connections (max 4 s, 150 ms poll)
  return new Promise((resolve) => {
    const deadline = Date.now() + 4000
    const check = () => {
      const probe = http.get(
        { hostname: '127.0.0.1', port: 8766, path: '/health', timeout: 300 },
        (res) => {
          res.resume()
          // Got a response → process still alive
          if (Date.now() >= deadline) { resolve(); return }
          setTimeout(check, 150)
        },
      )
      probe.on('error', () => resolve())            // ECONNREFUSED → port is free
      probe.on('timeout', () => { probe.destroy(); resolve() })
    }
    check()
  })
}

function startBackend(): void {
  const backendDir = isDev
    ? path.join(__dirname, '../../backend')
    : path.join(process.resourcesPath, 'backend')
  const python = path.join(backendDir, '.venv', 'Scripts', 'python.exe')
  const script  = path.join(backendDir, 'main.py')
  if (!fs.existsSync(script)) { console.warn('[Backend] main.py not found, skipping'); return }
  if (!fs.existsSync(python)) { console.warn('[Backend] python.exe not found, skipping'); return }
  backendProcess = spawn(python, [script], { cwd: backendDir, stdio: 'pipe', detached: false })
  backendProcess.stderr?.on('data', (d: Buffer) => console.error('[Backend]', d.toString().trimEnd()))
  backendProcess.stdout?.on('data', (d: Buffer) => console.log('[Backend]',  d.toString().trimEnd()))
  backendProcess.on('exit',  (code, sig) => { console.warn(`[Backend] exited code=${code} signal=${sig}`); backendProcess = null })
  backendProcess.on('error', (err)       => { console.error('[Backend] spawn error:', err.message);        backendProcess = null })
}

// ── Unity ─────────────────────────────────────────────────────────────────────

function findUnityExe(): string | null {
  const canonical = isDev
    ? path.join(__dirname, '../../unity-build/DottyPet.exe')
    : path.join(process.resourcesPath, 'unity-build', 'DottyPet.exe')
  if (fs.existsSync(canonical)) return canonical
  console.warn(`[Unity] DottyPet.exe not found at: ${canonical}`)
  return null
}

function startUnity(): void {
  if (unityProcess && !unityProcess.killed) return   // already running
  const exe = findUnityExe()
  if (!exe) return
  console.log(`[Unity] Launching: ${exe}`)
  unityProcess = spawn(exe, [], { stdio: 'ignore', detached: false })
  unityProcess.on('exit',  (code, sig) => { console.warn(`[Unity] exited code=${code} signal=${sig}`); unityProcess = null })
  unityProcess.on('error', (err)       => { console.error('[Unity] spawn error:', err.message);        unityProcess = null })
}

function killUnity(): void {
  if (!unityProcess) return
  const pid = unityProcess.pid
  unityProcess.removeAllListeners()
  unityProcess = null
  if (pid) killByPid(pid)
}

// ── Unity status ──────────────────────────────────────────────────────────────

interface UnityStatus { online: boolean; wx: number; wy: number; ww: number; wh: number }
let cachedStatus: UnityStatus = { online: false, wx: 0, wy: 0, ww: 0, wh: 0 }

function fetchStatus(): Promise<UnityStatus> {
  return new Promise(resolve => {
    const req = http.get(
      { hostname: '127.0.0.1', port: 8765, path: '/status', timeout: 600 },
      res => {
        let data = ''
        res.on('data', c => { data += c })
        res.on('end', () => {
          try {
            const j = JSON.parse(data)
            cachedStatus = { online: res.statusCode === 200, wx: j.wx ?? 0, wy: j.wy ?? 0, ww: j.ww ?? 0, wh: j.wh ?? 0 }
          } catch {}
          resolve(cachedStatus)
        })
      }
    )
    req.on('error', () => resolve(cachedStatus))
    req.on('timeout', () => { req.destroy(); resolve(cachedStatus) })
  })
}

// ── DPI scaling ───────────────────────────────────────────────────────────────
// uiohook returns physical (raw) pixels via WH_MOUSE_LL, which is unaffected by
// process DPI awareness. Electron's BrowserWindow.setPosition() expects logical
// pixels. Rather than converting uiohook coords, we read the cursor position
// directly from Electron's screen module at the moment of the event — this gives
// us the correct logical coords on all DPI/multi-monitor configurations.

function getCursorLogical(): { x: number; y: number } {
  return screen.getCursorScreenPoint()
}

// ── Chat window ───────────────────────────────────────────────────────────────

const CHAT_W = 320
const CHAT_H = 480
let chatWindow: BrowserWindow | null = null
let chatReady = false

function getChatPosition(): { x: number; y: number } {
  const { wx, wy, ww, wh } = cachedStatus
  // Position to the left of the Unity pet window, vertically centred
  const x = Math.max(0, wx - CHAT_W - 12)
  const y = Math.max(0, wy + Math.round(wh / 2) - Math.round(CHAT_H / 2))
  return { x, y }
}

function createChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) return

  chatReady = false
  const { x, y } = getChatPosition()
  chatWindow = new BrowserWindow({
    width: CHAT_W, height: CHAT_H,
    x, y,
    frame: false, transparent: true,
    alwaysOnTop: true, skipTaskbar: true, resizable: false,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  })

  const chatHtml = isDev
    ? path.join(__dirname, '../public/pet-chat.html')
    : path.join(__dirname, '../dist/pet-chat.html')
  chatWindow.loadFile(chatHtml)
  chatWindow.once('ready-to-show', () => { chatReady = true })
  chatWindow.on('close', (e: Electron.Event) => {
    if (!isQuitting) { e.preventDefault(); chatWindow?.hide() }
  })
}

function destroyChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.removeAllListeners('close')
    chatWindow.destroy()
    chatWindow = null
  }
}

function showChatWindow() {
  if (!chatWindow || chatWindow.isDestroyed()) {
    createChatWindow()
  }

  const placeAndShow = () => {
    if (!chatWindow || chatWindow.isDestroyed()) return
    const { x, y } = getChatPosition()
    chatWindow.setPosition(x, y)
    chatWindow.show()
    chatWindow.focus()
  }

  if (chatReady) {
    placeAndShow()
    return
  }

  const deadline = Date.now() + 3000
  const poll = setInterval(() => {
    if (chatReady) { clearInterval(poll); placeAndShow() }
    else if (Date.now() > deadline) { clearInterval(poll) }
  }, 20)
}

function hideChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) chatWindow.hide()
}

// ── Menu window ───────────────────────────────────────────────────────────────

const MENU_W = 160
const MENU_H = 190

function hideMenu() {
  if (menuWindow && !menuWindow.isDestroyed()) menuWindow.hide()
}

let menuReady = false

// Pre-create the menu window so first right-click shows instantly (no load delay)
function createMenuWindow() {
  if (menuWindow && !menuWindow.isDestroyed()) return

  menuReady = false
  menuWindow = new BrowserWindow({
    width: MENU_W, height: MENU_H,
    x: -9999, y: -9999,
    frame: false, transparent: true,
    alwaysOnTop: true, skipTaskbar: true, resizable: false,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  })

  const menuHtml = isDev
    ? path.join(__dirname, '../public/pet-menu.html')
    : path.join(__dirname, '../dist/pet-menu.html')
  menuWindow.loadFile(menuHtml)
  menuWindow.once('ready-to-show', () => { menuReady = true })
  // Prevent accidental closure — hide instead. Use 'close' event with destroy guard.
  menuWindow.on('close', (e: Electron.Event) => {
    if (!isQuitting) { e.preventDefault(); menuWindow?.hide() }
  })
  // Auto-hide when the menu loses focus (e.g. user Alt+Tabs away)
  menuWindow.on('blur', () => {
    if (!isQuitting) hideMenu()
  })
}

function destroyMenuWindow() {
  if (menuWindow && !menuWindow.isDestroyed()) {
    menuWindow.removeAllListeners('close')
    menuWindow.destroy()
    menuWindow = null
  }
}

function showMenuWindow(cursor?: { x: number; y: number }) {
  if (!menuWindow || menuWindow.isDestroyed()) {
    createMenuWindow()
  }

  // Use the cursor position captured at mouseup time (passed in) so the menu
  // appears at the correct spot even when placeAndShow is deferred.
  const pos = cursor ?? getCursorLogical()

  const placeAndShow = () => {
    if (!menuWindow || menuWindow.isDestroyed()) return
    // Keep menu within screen bounds
    const display = screen.getDisplayNearestPoint(pos)
    const { x: sx, y: sy, width: sw, height: sh } = display.workArea
    const posX = Math.min(pos.x + 16, sx + sw - MENU_W)
    const posY = Math.min(Math.max(pos.y - Math.round(MENU_H / 2), sy), sy + sh - MENU_H)
    menuWindow.setPosition(posX, posY)
    // Reset any overlay state (e.g. exit-confirm) before showing.
    menuWindow.webContents.send('menu-reset')
    menuWindow.show()
    menuWindow.focus()
  }

  if (menuReady) {
    placeAndShow()
    return
  }

  // Window not ready yet — poll until ready-to-show fires (set by createMenuWindow).
  // Cap at 3 s to avoid leaking the interval if something goes wrong.
  const deadline = Date.now() + 3000
  const poll = setInterval(() => {
    if (menuReady) {
      clearInterval(poll)
      placeAndShow()
    } else if (Date.now() > deadline) {
      clearInterval(poll)
    }
  }, 20)
}

function isInsideMenu(cursor?: { x: number; y: number }): boolean {
  if (!menuWindow || menuWindow.isDestroyed() || !menuWindow.isVisible()) return false
  const { x, y } = cursor ?? getCursorLogical()
  const [mx, my] = menuWindow.getPosition()
  // Use a 5px inset to exclude the transparent margin around .panel,
  // so clicks on the transparent edge correctly dismiss the menu.
  const inset = 5
  return x >= mx + inset && x <= mx + MENU_W - inset &&
         y >= my + inset && y <= my + MENU_H - inset
}

// ── Global mouse hook ─────────────────────────────────────────────────────────

// Use timestamp instead of boolean flag to avoid state getting stuck
// when mousedown/mouseup events don't pair correctly on some Windows setups.
let menuHiddenAt = 0
const HIDE_DEBOUNCE_MS = 300
let pendingMenuPoll: ReturnType<typeof setInterval> | null = null

// Only show menu when Unity has signalled a right-click on the pet model.
// We store the timestamp of the signal instead of a boolean so we can:
//   1. Handle the race where mouseup arrives before the HTTP POST (pendingMenuShow
//      is still false when mouseup fires — we check again with a short retry).
//   2. Auto-expire stale signals so a missed mouseup never poisons the next click.
let pendingMenuShowAt = 0
const PENDING_MENU_TTL_MS = 1500  // signal expires after 1.5 s

function startGlobalMouseHook() {
  uIOhook.on('mousedown', (e: UiohookMouseEvent) => {
    if (menuWindow && !menuWindow.isDestroyed() && menuWindow.isVisible()) {
      // Read logical cursor position once and reuse it for the hit-test,
      // avoiding a second getCursorScreenPoint() call that could return
      // a slightly different position on high-DPI displays.
      const cursor = getCursorLogical()
      if (!isInsideMenu(cursor)) {
        // Any click outside the menu dismisses it.
        // Only stamp menuHiddenAt for right-clicks — left-clicks must not
        // trigger the debounce that would suppress the next right-click signal.
        if (e.button === 2) menuHiddenAt = Date.now()
        hideMenu()
      }
    }
  })

  uIOhook.on('mouseup', (e: UiohookMouseEvent) => {
    if (e.button !== 2) return
    if (Date.now() - menuHiddenAt < HIDE_DEBOUNCE_MS) {
      // This right-click was used to dismiss the menu — discard any pending signal
      // so it doesn't accidentally trigger the menu on the next unrelated right-click.
      pendingMenuShowAt = 0
      return
    }

    // Capture cursor position now, before any async delay, so the menu
    // appears at the correct spot even if placeAndShow is deferred.
    const cursorAtMouseUp = getCursorLogical()

    const tryShow = () => {
      const age = Date.now() - pendingMenuShowAt
      if (age < 0 || age > PENDING_MENU_TTL_MS) return  // no valid signal
      pendingMenuShowAt = 0
      showMenuWindow(cursorAtMouseUp)
    }

    if (pendingMenuShowAt > 0) {
      // Signal already arrived — show immediately.
      tryShow()
    } else {
      // mouseup beat the HTTP POST; wait up to 300 ms for the signal to arrive.
      // Cancel any previous poll to prevent double-show on rapid right-clicks.
      if (pendingMenuPoll !== null) { clearInterval(pendingMenuPoll); pendingMenuPoll = null }
      const deadline = Date.now() + 300
      pendingMenuPoll = setInterval(() => {
        if (pendingMenuShowAt > 0) {
          clearInterval(pendingMenuPoll!); pendingMenuPoll = null
          tryShow()
        } else if (Date.now() > deadline) {
          clearInterval(pendingMenuPoll!); pendingMenuPoll = null
        }
      }, 5)
    }
  })

  try {
    uIOhook.start()
    console.log('[MouseHook] Started')
  } catch (err) {
    console.error('[MouseHook] Failed to start:', (err as Error).message)
  }
}

function stopGlobalMouseHook() {
  try { uIOhook.stop() } catch {}
}

// ── Main window ───────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100, height: 720, resizable: false, frame: false,
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
    title: 'Dotty Pet',
  })
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Frameless windows on Windows lose OS clipboard shortcuts.
  // copy/cut: delegate to webContents built-ins (they work fine).
  // paste: execCommand('paste') is blocked by security policy, so we read
  //        the clipboard in main process and send the text to the renderer
  //        via IPC, where the focused textarea inserts it directly.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!input.control || input.type !== 'keyDown') return
    const key = input.key.toLowerCase()
    if (key === 'c') { mainWindow?.webContents.copy();      event.preventDefault() }
    if (key === 'x') { mainWindow?.webContents.cut();       event.preventDefault() }
    if (key === 'a') { mainWindow?.webContents.selectAll(); event.preventDefault() }
    if (key === 'z') { mainWindow?.webContents.undo();      event.preventDefault() }
    if (key === 'y') { mainWindow?.webContents.redo();      event.preventDefault() }
    if (key === 'v') {
      const text = clipboard.readText()
      mainWindow?.webContents.send('clipboard-paste', text)
      event.preventDefault()
    }
  })

  // Once the main window is ready, we're no longer in the launch transition.
  mainWindow.once('ready-to-show', () => {
    isLaunchingMainApp = false
    mainWindow?.show()
  })
  mainWindow.on('closed', () => {
    mainWindow = null
    // Main window is the app's primary window — quit when it closes
    app.quit()
  })
}

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-close',    () => app.quit())
ipcMain.on('open-task-manager', () => {
  // shell.openPath is the most reliable way to launch a system executable
  // from Electron on Windows — avoids spawn PATH resolution issues.
  shell.openPath(path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'Taskmgr.exe'))
})

// ── Chat streaming via IPC ─────────────────────────────────────────────────
// Electron's renderer fetch() cannot reliably stream from localhost when the
// page is loaded as a file:// URL. We proxy the request through the main
// process (Node.js http) and push chunks to the renderer via IPC instead.

ipcMain.on('chat-stream-start', (event, payload: {
  messages: object[], provider: string, model: string
}) => {
  const body = JSON.stringify(payload)
  const req = http.request(
    { hostname: '127.0.0.1', port: 8766, path: '/chat/', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
    (res) => {
      let buf = ''
      res.on('data', (chunk: Buffer) => {
        buf += chunk.toString('utf8')
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          event.sender.send('chat-stream-chunk', trimmed)
        }
      })
      res.on('end', () => {
        if (buf.trim()) event.sender.send('chat-stream-chunk', buf.trim())
        event.sender.send('chat-stream-end')
      })
    }
  )
  req.on('error', (err: Error) => {
    event.sender.send('chat-stream-error', err.message)
  })
  req.write(body)
  req.end()
})

ipcMain.handle('unity-check', async () => {
  const s = await fetchStatus()
  return { online: s.online, hasExe: findUnityExe() !== null }
})

ipcMain.handle('unity-launch', async () => {
  if (unityProcess && !unityProcess.killed) return { ok: false, reason: 'already running' }
  const exe = findUnityExe()
  if (!exe) return { ok: false, reason: 'no exe found' }
  unityProcess = spawn(exe, [], { stdio: 'ignore', detached: false })
  return { ok: true }
})

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'VRM Model', extensions: ['vrm'] }],
    properties: ['openFile'],
  })
  return result.filePaths[0] ?? null
})

// ── VRM model loading ─────────────────────────────────────────────────────────
// The renderer passes the raw path it received from open-file-dialog.
// We re-validate here (defence-in-depth) before forwarding to Unity.

const VRM_MAX_BYTES = 500 * 1024 * 1024 // 500 MB

ipcMain.handle('load-vrm-model', async (_e, rawPath: unknown) => {
  if (typeof rawPath !== 'string' || !rawPath) {
    return { ok: false, reason: 'Invalid path' }
  }

  // Resolve to an absolute path — prevents traversal tricks
  const resolved = path.resolve(rawPath)

  // Directory whitelist — VRM files must live under a user-accessible folder.
  // This prevents a compromised renderer from loading arbitrary system paths.
  const allowedRoots = [
    app.getPath('documents'),
    app.getPath('downloads'),
    app.getPath('desktop'),
    app.getPath('home'),
  ]
  const underAllowedRoot = allowedRoots.some(root =>
    resolved.toLowerCase().startsWith(root.toLowerCase() + path.sep) ||
    resolved.toLowerCase() === root.toLowerCase()
  )
  if (!underAllowedRoot) {
    return { ok: false, reason: 'File must be located in Documents, Downloads, Desktop, or Home folder' }
  }

  // Extension whitelist — only .vrm files
  if (path.extname(resolved).toLowerCase() !== '.vrm') {
    return { ok: false, reason: 'Only .vrm files are supported' }
  }

  // Size check — read stat without loading the file into memory
  let stat: fs.Stats
  try {
    stat = await fs.promises.stat(resolved)
  } catch {
    return { ok: false, reason: 'File not found' }
  }
  if (stat.size > VRM_MAX_BYTES) {
    return { ok: false, reason: `File too large (max ${VRM_MAX_BYTES / 1024 / 1024} MB)` }
  }

  // Forward the resolved path to Unity via HTTP POST.
  // Collect the response body to verify Unity actually accepted the request.
  const unityResult = await new Promise<{ ok: boolean; reason?: string }>((resolve) => {
    const data = JSON.stringify({ path: resolved })
    const req = http.request(
      { hostname: '127.0.0.1', port: 8765, path: '/model', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        timeout: 3000 },
      (res) => {
        let body = ''
        res.on('data', (chunk) => { body += chunk })
        res.on('end', () => {
          try {
            const json = JSON.parse(body)
            if (json.error) resolve({ ok: false, reason: `Unity error: ${json.error}` })
            else resolve({ ok: true })
          } catch {
            // Response wasn't JSON — still treat as success if status is 2xx
            resolve(res.statusCode !== undefined && res.statusCode < 300
              ? { ok: true }
              : { ok: false, reason: `Unity returned HTTP ${res.statusCode}` })
          }
        })
      }
    )
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, reason: 'Unity did not respond in time' }) })
    req.on('error', () => resolve({ ok: false, reason: 'Unity is not running or refused connection' }))
    req.write(data)
    req.end()
  })

  if (!unityResult.ok) {
    return { ok: false, reason: unityResult.reason ?? 'Unity did not accept the model' }
  }

  return { ok: true, name: path.basename(resolved, '.vrm') }
})

// ── VRM model reset ───────────────────────────────────────────────────────────
// Sends an empty path to Unity to restore the default avatar.
// Kept in main process so it goes through the same channel as load-vrm-model.

ipcMain.handle('reset-vrm-model', async () => {
  const result = await new Promise<boolean>((resolve) => {
    const data = JSON.stringify({ path: '' })
    const req = http.request(
      { hostname: '127.0.0.1', port: 8765, path: '/model', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        timeout: 2000 },
      (res) => { res.resume(); resolve(res.statusCode !== undefined && res.statusCode < 300) }
    )
    req.on('timeout', () => { req.destroy(); resolve(false) })
    req.on('error', () => resolve(false))
    req.write(data)
    req.end()
  })
  // Always return ok — UI should reset regardless of whether Unity responded
  return { ok: true, unityReached: result }
})

ipcMain.on('menu-navigate', (_e, page: string) => {
  hideMenu()
  if (page === 'exit') { app.quit(); return }
  const target = page === 'settings' ? 'setting' : page
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.send('navigate', target)
  }
})

ipcMain.on('menu-close', () => hideMenu())

// ── Chat IPC ──────────────────────────────────────────────────────────────────

ipcMain.on('chat-open', () => { hideMenu(); showChatWindow() })
ipcMain.on('chat-close', () => hideChatWindow())

ipcMain.on('chat-confirm-event', (_e, eventData) => {
  // Forward the confirmed event to the main window so it can call addEvent()
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.webContents.send('chat-event-confirmed', eventData)
  }
})

// ── HTTP server (port 8767) ───────────────────────────────────────────────────

function startMenuServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', 'application/json')
    if (req.method === 'OPTIONS') { res.end('{}'); return }
    if (req.method === 'GET' && req.url === '/health') { res.end('{"ok":true}'); return }
    if (req.method === 'POST' && req.url === '/menu') {
      let body = ''
      req.on('data', c => { body += c })
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          const wx = parsed.wx, wy = parsed.wy
          // Only treat as a valid signal if Unity sent window position data
          if (wx !== undefined) {
            cachedStatus = {
              ...cachedStatus, online: true,
              wx: wx ?? 0, wy: wy ?? 0,
              ww: parsed.ww ?? cachedStatus.ww,
              wh: parsed.wh ?? cachedStatus.wh,
            }
            pendingMenuShowAt = Date.now()
          }
        } catch {}
        res.end('{"ok":true}')
      })
      return
    }
    res.statusCode = 404
    res.end('{"error":"not found"}')
  })
  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error('[MenuServer]', err.message)
  })
  server.listen(8767, '127.0.0.1', () => console.log('[MenuServer] Listening on 8767'))
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

// Read the persisted auth user from the default Electron userData path.
// We replicate the same localStorage key the renderer uses so we can check
// login state before any window is created.
function readPersistedUser(): boolean {
  try {
    const storePath = path.join(app.getPath('userData'), 'Local Storage', 'leveldb')
    // leveldb is binary — we can't parse it easily here.
    // Instead we use a lightweight side-car file that the renderer writes.
    const sidecar = path.join(app.getPath('userData'), 'auth-session.json')
    if (!fs.existsSync(sidecar)) return false
    const data = JSON.parse(fs.readFileSync(sidecar, 'utf8'))
    return typeof data?.id === 'string' && data.id.length > 0
  } catch {
    return false
  }
}

// ── Login window ──────────────────────────────────────────────────────────────

const LOGIN_W = 420
const LOGIN_H = 560
let loginWindow: BrowserWindow | null = null
let loginWindowWebContentsId: number | null = null

function createLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) { loginWindow.focus(); return }

  loginWindow = new BrowserWindow({
    width: LOGIN_W,
    height: LOGIN_H,
    resizable: false,
    frame: false,
    center: true,
    show: false,
    title: 'Dotty Pet — Sign in',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  })

  // Record the webContents ID immediately so auth:is-login-window can identify
  // this window even before loginWindow variable is visible to the handler.
  loginWindowWebContentsId = loginWindow.webContents.id

  if (isDev) {
    loginWindow.loadURL('http://localhost:5173')
  } else {
    loginWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  loginWindow.once('ready-to-show', () => loginWindow?.show())

  // Closing the login window = quit, UNLESS we're in the middle of launching the main app.
  loginWindow.on('close', () => {
    loginWindowWebContentsId = null
    loginWindow = null
    if (!isLaunchingMainApp && (!mainWindow || mainWindow.isDestroyed())) app.quit()
  })
}

function destroyLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.removeAllListeners('close')
    loginWindow.destroy()
    loginWindow = null
    loginWindowWebContentsId = null
  }
}

let isLaunchingMainApp = false
let isLoggingOut = false   // true while logout teardown is in progress

// ── App startup ───────────────────────────────────────────────────────────────

let menuServerStarted = false
let mouseHookStarted = false

// Poll the backend /health endpoint until it responds or we give up.
// Resolves true when ready, false on timeout.
// Uses short timeouts so we detect readiness as fast as possible.
function waitForBackend(timeoutMs = 15000, intervalMs = 100): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs
    const attempt = () => {
      const req = http.get(
        { hostname: '127.0.0.1', port: 8766, path: '/health', timeout: 300 },
        (res) => {
          res.resume()
          if (res.statusCode === 200) { resolve(true); return }
          retry()
        }
      )
      req.on('error', retry)
      req.on('timeout', () => { req.destroy(); retry() })
    }
    const retry = () => {
      if (Date.now() >= deadline) { resolve(false); return }
      setTimeout(attempt, intervalMs)
    }
    attempt()
  })
}

// Tracks backend readiness so renderer can query it at any time.
type BackendReadyState = 'pending' | 'ready' | 'error'
let backendReadyState: BackendReadyState = 'pending'
let backendErrorMsg = ''

// IPC: renderer calls this once it mounts to get the current backend state.
// This avoids the race where main pushes 'backend:ready' before the renderer
// has registered its listener.
ipcMain.handle('backend:get-status', () => backendReadyState)

async function launchMainApp() {
  backendReadyState = 'pending'
  backendErrorMsg = ''

  // In dev mode the backend is already running via `npm run dev:backend`.
  // Only spawn it when running as a packaged app.
  if (!isDev) startBackend()
  startUnity()
  if (!menuServerStarted) { startMenuServer(); menuServerStarted = true }
  if (!mouseHookStarted) { startGlobalMouseHook(); mouseHookStarted = true }

  // Create the window immediately — it shows a loading screen while we wait.
  createWindow()
  createMenuWindow()

  // Wait for backend health check in parallel with window load.
  const ready = await waitForBackend()

  if (ready) {
    backendReadyState = 'ready'
    console.log('[Backend] Health check passed')
  } else {
    backendReadyState = 'error'
    backendErrorMsg = 'Backend failed to start within 15 seconds.'
    console.error('[Backend] Health check timed out')
  }

  // Push to renderer if the window is already showing the loading screen.
  // If the window isn't ready yet, the renderer will call backend:get-status
  // on mount and get the already-resolved state synchronously.
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (ready) {
      mainWindow.webContents.send('backend:ready')
    } else {
      mainWindow.webContents.send('backend:error', backendErrorMsg)
    }
  }
}

// ── IPC: which window am I? ───────────────────────────────────────────────────
// Renderer calls ipcRenderer.sendSync('auth:is-login-window') in preload.
// We compare by webContents ID (set at window creation) rather than the loginWindow
// reference, because the sendSync fires during preload execution — before the
// BrowserWindow constructor returns on some Electron versions.
ipcMain.on('auth:is-login-window', (event) => {
  event.returnValue = event.sender.id === loginWindowWebContentsId
})

// ── IPC: persist auth session (sidecar file) ──────────────────────────────────
// localStorage is not readable from the main process, so the renderer writes
// a tiny sidecar JSON file that main.ts can read on next startup.
const authSidecarPath = () => path.join(app.getPath('userData'), 'auth-session.json')

ipcMain.on('auth:write-session', (_e, userJson: string) => {
  try { fs.writeFileSync(authSidecarPath(), userJson, 'utf8') } catch {}
})

ipcMain.on('auth:clear-session', () => {
  try { fs.unlinkSync(authSidecarPath()) } catch {}
})

// ── IPC: login success ────────────────────────────────────────────────────────
ipcMain.on('auth:login-success', () => {
  isLaunchingMainApp = true
  destroyLoginWindow()
  void launchMainApp()
  // Do NOT reset isLaunchingMainApp here — window-all-closed fires asynchronously
  // after destroy(). It gets reset in createWindow() once the main window is ready.
})

// ── IPC: logout ───────────────────────────────────────────────────────────────
ipcMain.on('auth:logout-ready', () => {
  isLoggingOut = true   // prevent window-all-closed from quitting the app

  destroyChatWindow()
  destroyMenuWindow()
  stopGlobalMouseHook()
  killUnity()

  // Close main window without triggering app quit
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.removeAllListeners('closed')
    mainWindow.destroy()
    mainWindow = null
  }

  // Wait for backend port to be free, then show login window.
  // isLoggingOut stays true until the login window is visible so that
  // window-all-closed (which fires while all windows are momentarily gone)
  // does not call app.quit().
  void killBackend().then(() => {
    isLoggingOut = false
    createLoginWindow()
  })
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

// Single-instance lock — if a second instance is launched, focus the existing
// window and quit the new one immediately.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    } else if (loginWindow) {
      if (loginWindow.isMinimized()) loginWindow.restore()
      loginWindow.focus()
    }
  })

  app.whenReady().then(() => {
    // Set a minimal application menu so that standard keyboard shortcuts
    // (Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+Z) work in text inputs even
    // though the window is frameless and has no visible menu bar.
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
          { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
    ]))

    if (readPersistedUser()) {
      // Already logged in — go straight to the main app
      void launchMainApp()
    } else {
      // Not logged in — show only the login window
      createLoginWindow()
    }
  })

  app.on('window-all-closed', () => {
    // Don't quit during transitions where windows are momentarily all closed:
    //   isLaunchingMainApp — login window destroyed, main window about to open
    //   isLoggingOut       — main window destroyed, waiting for backend to die,
    //                        login window about to open
    if (isLaunchingMainApp || isLoggingOut) return
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    isQuitting = true
    isLoggingOut = false   // ensure window-all-closed doesn't block the quit
    killBackend()   // fire-and-forget on quit — OS will reap the process
    killUnity()
    stopGlobalMouseHook()
    destroyMenuWindow()
    destroyChatWindow()
    destroyLoginWindow()
  })

  // Last-resort cleanup if the process is killed externally (e.g. task manager).
  // Synchronous — keep it minimal.
  process.on('exit', () => {
    if (backendProcess?.pid) killByPid(backendProcess.pid)
    if (unityProcess?.pid)   killByPid(unityProcess.pid)
  })
}
