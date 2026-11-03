import type { FormalizeProgress } from '../../shared/formalize'
import type { ProveProgress } from '../../shared/prove'
import type { FileContent, FileKey, ProblemSummary, TexSourceKey } from '../../shared/problem'
import type { ToolId, ToolStatus } from '../../shared/toolchain'

export interface ProofStudioApi {
  listProblems: () => Promise<ProblemSummary[]>
  openFolder: () => Promise<{ problems: ProblemSummary[]; id: string } | null>
  deleteProblem: (id: string) => Promise<ProblemSummary[]>
  addSource: (id: string, base64: string, mime: string) => Promise<ProblemSummary[]>
  readFile: (id: string, key: FileKey) => Promise<FileContent>
  writeText: (id: string, text: string) => Promise<ProblemSummary[]>
  hasApiKey: () => Promise<boolean>
  setApiKey: (key: string) => Promise<void>
  transcribe: (id: string) => Promise<ProblemSummary[]>
  formalize: (id: string) => Promise<ProblemSummary[]>
  onFormalizeProgress: (listener: (progress: FormalizeProgress) => void) => () => void
  prove: (id: string) => Promise<ProblemSummary[]>
  onProveProgress: (listener: (progress: ProveProgress) => void) => () => void
  compilePdf: (id: string, sourceKey: TexSourceKey) => Promise<ProblemSummary[]>
  toolchainStatus: () => Promise<ToolStatus[]>
  openInstall: (id: ToolId) => Promise<void>
}

declare global {
  interface Window {
    proofStudio: ProofStudioApi
  }
}

export {}
