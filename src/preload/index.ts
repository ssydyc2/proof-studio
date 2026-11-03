import { contextBridge, ipcRenderer } from 'electron'
import type { FormalizeProgress } from '../shared/formalize'
import type { FileContent, FileKey, ProblemSummary, TexSourceKey } from '../shared/problem'
import type { ToolId, ToolStatus } from '../shared/toolchain'

const api = {
  listProblems: (): Promise<ProblemSummary[]> => ipcRenderer.invoke('problems:list'),
  openFolder: (): Promise<{ problems: ProblemSummary[]; id: string } | null> =>
    ipcRenderer.invoke('problems:open-folder'),
  deleteProblem: (id: string): Promise<ProblemSummary[]> => ipcRenderer.invoke('problems:delete', id),
  addSource: (id: string, base64: string, mime: string): Promise<ProblemSummary[]> =>
    ipcRenderer.invoke('problems:add-source', id, base64, mime),
  readFile: (id: string, key: FileKey): Promise<FileContent> => ipcRenderer.invoke('problems:read', id, key),
  writeText: (id: string, text: string): Promise<ProblemSummary[]> =>
    ipcRenderer.invoke('problems:write-text', id, text),
  hasApiKey: (): Promise<boolean> => ipcRenderer.invoke('api-key:has'),
  setApiKey: (key: string): Promise<void> => ipcRenderer.invoke('api-key:set', key),
  transcribe: (id: string): Promise<ProblemSummary[]> => ipcRenderer.invoke('problems:transcribe', id),
  formalize: (id: string): Promise<ProblemSummary[]> => ipcRenderer.invoke('problems:formalize', id),
  onFormalizeProgress: (listener: (progress: FormalizeProgress) => void): (() => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, progress: FormalizeProgress) => listener(progress)
    ipcRenderer.on('formalize:progress', wrapped)
    return () => {
      ipcRenderer.removeListener('formalize:progress', wrapped)
    }
  },
  compilePdf: (id: string, sourceKey: TexSourceKey): Promise<ProblemSummary[]> =>
    ipcRenderer.invoke('problems:compile', id, sourceKey),
  toolchainStatus: (): Promise<ToolStatus[]> => ipcRenderer.invoke('environment:status'),
  openInstall: (id: ToolId): Promise<void> => ipcRenderer.invoke('environment:open', id)
}

export type ProofStudioApi = typeof api

contextBridge.exposeInMainWorld('proofStudio', api)
