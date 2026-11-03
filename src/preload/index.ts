import { contextBridge, ipcRenderer } from 'electron'
import type { ExplainProgress } from '../shared/explain'
import type { FormalizeProgress } from '../shared/formalize'
import type { ProveProgress } from '../shared/prove'
import type { LeanRange } from '../shared/locate'
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
  prove: (id: string, attempts: number): Promise<ProblemSummary[]> =>
    ipcRenderer.invoke('problems:prove', id, attempts),
  onProveProgress: (listener: (progress: ProveProgress) => void): (() => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, progress: ProveProgress) => listener(progress)
    ipcRenderer.on('prove:progress', wrapped)
    return () => {
      ipcRenderer.removeListener('prove:progress', wrapped)
    }
  },
  explain: (id: string): Promise<ProblemSummary[]> => ipcRenderer.invoke('problems:explain', id),
  onExplainProgress: (listener: (progress: ExplainProgress) => void): (() => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, progress: ExplainProgress) => listener(progress)
    ipcRenderer.on('explain:progress', wrapped)
    return () => {
      ipcRenderer.removeListener('explain:progress', wrapped)
    }
  },
  compilePdf: (id: string, sourceKey: TexSourceKey): Promise<ProblemSummary[]> =>
    ipcRenderer.invoke('problems:compile', id, sourceKey),
  locateLean: (id: string, passage: string): Promise<LeanRange[]> =>
    ipcRenderer.invoke('problems:locate-lean', id, passage),
  toolchainStatus: (): Promise<ToolStatus[]> => ipcRenderer.invoke('environment:status'),
  openInstall: (id: ToolId): Promise<void> => ipcRenderer.invoke('environment:open', id)
}

export type ProofStudioApi = typeof api

contextBridge.exposeInMainWorld('proofStudio', api)
