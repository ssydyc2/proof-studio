export const LEAN_DIR = 'lean'

export const PROBLEM_FILES = [
  { key: 'source', filename: 'source.png', label: 'Screenshot' },
  { key: 'problemText', filename: 'problem.tex', label: 'Problem text' },
  { key: 'problemPdf', filename: 'problem.pdf', label: 'Problem PDF' },
  { key: 'leanStub', filename: 'stub.lean', label: 'Lean stub' },
  { key: 'leanProof', filename: 'proof.lean', label: 'Lean proof' },
  { key: 'readable', filename: 'readable.tex', label: 'Readable proof' },
  { key: 'readablePdf', filename: 'readable.pdf', label: 'Readable PDF' }
] as const

export type FileKey = (typeof PROBLEM_FILES)[number]['key']

export type FileState = 'empty' | 'current' | 'stale' | 'failed'

export type NextStep = 'add-screenshot' | 'transcribe' | 'formalize' | 'prove' | 'explain'

export type StepErrors = Partial<Record<FileKey, string>>

export type FileSnapshot = {
  key: FileKey
  filename: string
  label: string
  exists: boolean
  mtimeMs: number | null
}

export type ProblemFileView = {
  key: FileKey
  filename: string
  label: string
  state: FileState
  error?: string
}

export type ProblemSummary = {
  id: string
  title: string
  files: ProblemFileView[]
  nextStep: NextStep | null
}

export type FileContent =
  | { kind: 'image'; dataUrl: string; filename: string }
  | { kind: 'pdf'; dataUrl: string; filename: string }
  | { kind: 'text'; text: string; filename: string }
  | { kind: 'empty'; filename: string; error?: string }

export type TexSourceKey = 'problemText' | 'readable'

export type ProblemMeta = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  sourceFilename?: string
  errors?: StepErrors
}

const UPSTREAM: Record<FileKey, FileKey | null> = {
  source: null,
  problemText: 'source',
  problemPdf: 'problemText',
  leanStub: 'problemText',
  leanProof: 'leanStub',
  readable: 'leanProof',
  readablePdf: 'readable'
}

export const STEP_LABEL: Record<NextStep, string> = {
  'add-screenshot': 'Add screenshot',
  transcribe: 'Transcribe',
  formalize: 'Formalize',
  prove: 'Prove',
  explain: 'Explain'
}

export function stepEnabled(step: NextStep | null): boolean {
  return step === 'add-screenshot' || step === 'transcribe' || step === 'formalize' || step === 'prove'
}

export function fileState(
  file: { exists: boolean; mtimeMs: number | null },
  upstream: { exists: boolean; mtimeMs: number | null } | null,
  error: string | undefined
): FileState {
  if (!file.exists) return error ? 'failed' : 'empty'
  if (
    upstream?.exists &&
    upstream.mtimeMs != null &&
    file.mtimeMs != null &&
    upstream.mtimeMs > file.mtimeMs
  ) {
    return 'stale'
  }
  return 'current'
}

export function buildFileViews(snaps: FileSnapshot[], errors: StepErrors | undefined): ProblemFileView[] {
  const byKey = new Map(snaps.map((snap) => [snap.key, snap]))
  return snaps.map((snap) => {
    const upstreamKey = UPSTREAM[snap.key]
    const upstream = upstreamKey ? (byKey.get(upstreamKey) ?? null) : null
    const error = errors?.[snap.key]
    const state = fileState(snap, upstream, error)
    return {
      key: snap.key,
      filename: snap.filename,
      label: snap.label,
      state,
      error: state === 'failed' ? error : undefined
    }
  })
}

export function nextStep(files: ProblemFileView[]): NextStep | null {
  const byKey = new Map(files.map((file) => [file.key, file]))
  const source = byKey.get('source')
  const problemText = byKey.get('problemText')
  const leanStub = byKey.get('leanStub')
  const leanProof = byKey.get('leanProof')
  const readable = byKey.get('readable')
  if (!source || !problemText || !leanStub || !leanProof || !readable) return 'add-screenshot'

  if (source.state === 'empty' || source.state === 'failed') return 'add-screenshot'
  if (source.state === 'current' && problemText.state !== 'current') return 'transcribe'
  if (problemText.state === 'current' && leanStub.state !== 'current') return 'formalize'
  if (leanStub.state === 'current' && leanProof.state !== 'current') return 'prove'
  if (leanProof.state === 'current' && readable.state !== 'current') return 'explain'
  return null
}

export function ensureLatexDocument(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return trimmed
  if (trimmed.includes('\\documentclass')) return trimmed
  const body = trimmed.includes('\\begin{document}')
    ? trimmed
    : `\\begin{document}\n${trimmed}\n\\end{document}`
  return `\\documentclass{article}\n\\usepackage{amsmath,amssymb,amsthm}\n${body}\n`
}

export function titleFromProblemText(text: string): string {
  const bodyMatch = text.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/)
  const source = bodyMatch ? bodyMatch[1] : text
  const plain = source
    .replace(/\\(?:[a-zA-Z]+|.)/g, ' ')
    .replace(/[{}%$]/g, ' ')
    .split('\n')
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .find((item) => item.length > 0)
  return plain?.slice(0, 80) || 'Untitled problem'
}

export function pdfKeyFor(source: TexSourceKey): 'problemPdf' | 'readablePdf' {
  return source === 'problemText' ? 'problemPdf' : 'readablePdf'
}

export function fileByKey(files: ProblemFileView[], key: FileKey): ProblemFileView | undefined {
  return files.find((file) => file.key === key)
}
