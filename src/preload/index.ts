import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { BrainRequest, Project, SlateApi } from '../shared/types'

const api: SlateApi & { brainRunWith: (req: BrainRequest, backend: 'claude' | 'codex') => Promise<unknown> } = {
  listProjects: () => ipcRenderer.invoke('projects:list'),
  createProject: (name: string) => ipcRenderer.invoke('projects:create', name),
  openProject: (id: string) => ipcRenderer.invoke('projects:open', id),
  saveProject: (project: Project) => ipcRenderer.invoke('projects:save', project),
  deleteProject: (id: string) => ipcRenderer.invoke('projects:delete', id),
  revealProject: (id: string) => ipcRenderer.invoke('projects:reveal', id),
  brainStatus: () => ipcRenderer.invoke('brain:status'),
  brainRun: (req: BrainRequest) => ipcRenderer.invoke('brain:run', req),
  brainRunWith: (req: BrainRequest, backend: 'claude' | 'codex') =>
    ipcRenderer.invoke('brain:run', { ...req, backend }),
  brainCancel: (id: string) => ipcRenderer.invoke('brain:cancel', id),
  brainTest: (backend: 'claude' | 'codex') => ipcRenderer.invoke('brain:test', backend),
  pickMedia: () => ipcRenderer.invoke('media:pick'),
  pickAudio: () => ipcRenderer.invoke('media:pickAudio'),
  ingestMedia: (projectId: string, path: string) => ipcRenderer.invoke('media:ingest', projectId, path),
  analyzeAudio: (path: string) => ipcRenderer.invoke('sound:analyze', path),
  pathForFile: (file: File) => webUtils.getPathForFile(file),
  copyText: (text: string) => ipcRenderer.invoke('clipboard:copy', text),
  onProjectsChanged: (cb: () => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('projects:changed', listener)
    return () => ipcRenderer.removeListener('projects:changed', listener)
  },
  onHelpOpen: (cb: () => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('help:open', listener)
    return () => ipcRenderer.removeListener('help:open', listener)
  }
}

contextBridge.exposeInMainWorld('slate', api)
