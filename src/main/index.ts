import { app, BrowserWindow, ipcMain, dialog, shell, clipboard } from 'electron'
import { join } from 'path'
import { brainRun, brainCancel, brainStatus } from './brain'
import {
  listProjects,
  createProject,
  openProject,
  saveProject,
  deleteProject,
  projectsRoot
} from './projects'
import { startControlServer } from './control'
import { extractFrames, mediaKind } from './ingest'
import { analyzeAudio } from './audio'
import type { BrainRequest, Project } from '../shared/types'

let win: BrowserWindow | null = null

function notifyProjectsChanged(): void {
  win?.webContents.send('projects:changed')
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1520,
    height: 940,
    minWidth: 1100,
    minHeight: 680,
    title: 'Slate',
    icon: join(__dirname, '../../build/icon.png'),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 16 },
    backgroundColor: '#0c0d10',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(async () => {
  createWindow()
  await startControlServer(notifyProjectsChanged)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ---- IPC ----

ipcMain.handle('projects:list', () => listProjects())
ipcMain.handle('projects:create', (_e, name: string) => createProject(name))
ipcMain.handle('projects:open', (_e, id: string) => openProject(id))
ipcMain.handle('projects:save', (_e, project: Project) => saveProject(project))
ipcMain.handle('projects:delete', (_e, id: string) => deleteProject(id))
ipcMain.handle('projects:reveal', (_e, id: string) => {
  shell.showItemInFolder(join(projectsRoot(), id, 'project.json'))
})

ipcMain.handle('brain:status', () => brainStatus())
ipcMain.handle('brain:run', (_e, req: BrainRequest & { backend: 'claude' | 'codex' }) =>
  brainRun(req, req.backend)
)
ipcMain.handle('brain:cancel', (_e, id: string) => brainCancel(id))

ipcMain.handle('media:pick', async () => {
  const res = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'mov', 'm4v', 'webm', 'mkv'] }
    ]
  })
  return res.canceled ? [] : res.filePaths
})

ipcMain.handle('media:ingest', async (_e, projectId: string, path: string) => {
  const kind = mediaKind(path)
  if (!kind) throw new Error('Unsupported media type')
  if (kind === 'image') return { kind, frames: [path] }
  const frames = await extractFrames(projectId, path)
  return { kind, frames }
})

ipcMain.handle('media:pickAudio', async () => {
  const res = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      {
        name: 'Audio & Video',
        extensions: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'aif', 'aiff', 'mp4', 'mov', 'm4v', 'webm', 'mkv']
      }
    ]
  })
  return res.canceled ? [] : res.filePaths
})

ipcMain.handle('sound:analyze', (_e, path: string) => analyzeAudio(path))

ipcMain.handle('clipboard:copy', (_e, text: string) => {
  clipboard.writeText(text)
})
