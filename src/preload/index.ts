import { contextBridge, ipcRenderer } from 'electron'
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
  pickMedia: () => ipcRenderer.invoke('media:pick'),
  ingestMedia: (projectId: string, path: string) => ipcRenderer.invoke('media:ingest', projectId, path),
  copyText: (text: string) => ipcRenderer.invoke('clipboard:copy', text),
  onProjectsChanged: (cb: () => void) => {
    const listener = (): void => cb()
    ipcRenderer.on('projects:changed', listener)
    return () => ipcRenderer.removeListener('projects:changed', listener)
  }
}

contextBridge.exposeInMainWorld('slate', api)
