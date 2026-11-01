import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  PROBLEM_FILES,
  buildFileViews,
  nextStep,
  type FileContent,
  type FileKey,
  type FileSnapshot,
  type ProblemMeta,
  type ProblemSummary,
  type StepErrors
} from '../shared/problem'

const SOURCE_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif'
}

const MAX_IMAGE_BYTES = 50_000_000

export function openProblemFolder(folderPath: string): ProblemSummary {
  const dir = fs.realpathSync(folderPath)
  if (!fs.statSync(dir).isDirectory()) throw new Error('Choose a folder.')
  const name = path.basename(dir)
  if (!name || name === path.sep) throw new Error('Choose a folder.')

  const now = new Date().toISOString()
  const existing = readMeta(dir)
  const meta: ProblemMeta = existing ?? {
    id: `problem-${randomBytes(4).toString('hex')}`,
    title: name,
    createdAt: now,
    updatedAt: now
  }
  meta.title = existing && isAutoFolder(dir) ? existing.title : name
  meta.updatedAt = now
  writeMeta(dir, meta)

  const registry = readRegistry()
  for (const [id, saved] of Object.entries(registry)) {
    if (saved === dir && id !== meta.id) delete registry[id]
  }
  registry[meta.id] = dir
  writeRegistry(registry)
  return summarize(dir, meta)
}

export function listProblems(): ProblemSummary[] {
  adoptLegacyProblems()
  const summaries: ProblemSummary[] = []
  for (const [id, dir] of Object.entries(readRegistry())) {
    if (!fs.existsSync(dir)) continue
    const meta = readMeta(dir)
    if (!meta || meta.id !== id) continue
    const title = titleFor(dir, meta)
    if (meta.title !== title) {
      meta.title = title
      writeMeta(dir, meta)
    }
    summaries.push(summarize(dir, meta))
  }
  summaries.sort((a, b) => a.title.localeCompare(b.title))
  return summaries
}

const OWNED_FILES = [
  'problem.json',
  'problem.tex',
  'problem.pdf',
  'stub.lean',
  'proof.lean',
  'readable.tex',
  'readable.pdf',
  'source.png',
  'source.jpg',
  'source.jpeg',
  'source.webp',
  'source.gif'
]

export function deleteProblem(id: string): void {
  const dir = problemDir(id)
  const meta = requireMeta(dir)
  const names = new Set(OWNED_FILES)
  if (meta.sourceFilename) names.add(path.basename(meta.sourceFilename))
  for (const name of names) {
    const full = path.join(dir, name)
    if (fs.existsSync(full) && fs.statSync(full).isFile()) fs.unlinkSync(full)
  }
  const registry = readRegistry()
  delete registry[id]
  writeRegistry(registry)
  if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir)
}

export function addSource(id: string, bytes: Buffer, mime: string): ProblemSummary {
  const ext = SOURCE_MIME[mime]
  if (!ext) throw new Error('Use a PNG, JPEG, WebP, or GIF screenshot.')
  if (bytes.byteLength === 0) throw new Error('The screenshot was empty.')
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('This file is larger than 50 MB.')

  const dir = problemDir(id)
  const meta = requireMeta(dir)
  if (meta.sourceFilename) {
    const previous = path.join(dir, meta.sourceFilename)
    if (fs.existsSync(previous)) fs.unlinkSync(previous)
  }
  const filename = `source.${ext}`
  fs.writeFileSync(path.join(dir, filename), bytes)
  meta.sourceFilename = filename
  meta.updatedAt = new Date().toISOString()
  writeMeta(dir, meta)
  return summarize(dir, meta)
}

export function readFile(id: string, key: FileKey): FileContent {
  const dir = problemDir(id)
  const meta = requireMeta(dir)
  const snap = snapshots(dir, meta).find((item) => item.key === key)
  if (!snap) throw new Error('Unknown file.')
  if (!snap.exists) {
    const view = summarize(dir, meta).files.find((item) => item.key === key)
    return { kind: 'empty', filename: snap.filename, error: view?.error }
  }
  if (key === 'source') {
    const mime = MIME_BY_EXT[path.extname(snap.filename).slice(1)] ?? 'application/octet-stream'
    const bytes = fs.readFileSync(path.join(dir, snap.filename))
    return {
      kind: 'image',
      filename: snap.filename,
      dataUrl: `data:${mime};base64,${bytes.toString('base64')}`
    }
  }
  if (key === 'problemPdf' || key === 'readablePdf') {
    const bytes = fs.readFileSync(path.join(dir, snap.filename))
    return {
      kind: 'pdf',
      filename: snap.filename,
      dataUrl: `data:application/pdf;base64,${bytes.toString('base64')}`
    }
  }
  return {
    kind: 'text',
    filename: snap.filename,
    text: fs.readFileSync(path.join(dir, snap.filename), 'utf8')
  }
}

export function writeProblemText(id: string, text: string): ProblemSummary {
  const dir = problemDir(id)
  const meta = requireMeta(dir)
  fs.writeFileSync(path.join(dir, 'problem.tex'), text)
  meta.title = path.basename(dir)
  meta.updatedAt = new Date().toISOString()
  if (meta.errors?.problemText) {
    delete meta.errors.problemText
    if (Object.keys(meta.errors).length === 0) delete meta.errors
  }
  writeMeta(dir, meta)
  return summarize(dir, meta)
}

export function recordProblemError(id: string, key: FileKey, message: string): void {
  const dir = problemDir(id)
  const meta = requireMeta(dir)
  const errors: StepErrors = { ...meta.errors, [key]: message }
  meta.errors = errors
  meta.updatedAt = new Date().toISOString()
  writeMeta(dir, meta)
}

export function clearStepError(id: string, key: FileKey): ProblemSummary {
  const dir = problemDir(id)
  const meta = requireMeta(dir)
  if (meta.errors?.[key]) {
    delete meta.errors[key]
    if (Object.keys(meta.errors).length === 0) delete meta.errors
  }
  meta.updatedAt = new Date().toISOString()
  writeMeta(dir, meta)
  return summarize(dir, meta)
}

export function problemDirectory(id: string): string {
  const dir = problemDir(id)
  requireMeta(dir)
  return dir
}

export function readSource(id: string): { bytes: Buffer; mime: string; filename: string } {
  const content = readFile(id, 'source')
  if (content.kind !== 'image') throw new Error('No screenshot yet.')
  const match = content.dataUrl.match(/^data:(.+);base64,(.+)$/)
  if (!match) throw new Error('No screenshot yet.')
  return {
    filename: content.filename,
    mime: match[1],
    bytes: Buffer.from(match[2], 'base64')
  }
}

function summarize(dir: string, meta: ProblemMeta): ProblemSummary {
  const files = buildFileViews(snapshots(dir, meta), meta.errors)
  return {
    id: meta.id,
    title: meta.title,
    files,
    nextStep: nextStep(files)
  }
}

function snapshots(dir: string, meta: ProblemMeta): FileSnapshot[] {
  return PROBLEM_FILES.map((entry) => {
    const filename = entry.key === 'source' ? (meta.sourceFilename ?? entry.filename) : entry.filename
    const full = path.join(dir, filename)
    const exists = entry.key === 'source' ? Boolean(meta.sourceFilename && fs.existsSync(full)) : fs.existsSync(full)
    return {
      key: entry.key,
      filename: exists || entry.key !== 'source' ? filename : entry.filename,
      label: entry.label,
      exists,
      mtimeMs: exists ? fs.statSync(full).mtimeMs : null
    }
  })
}

function legacyRoot(): string {
  return process.env.PROOF_STUDIO_LEGACY ?? path.join(os.homedir(), 'Documents', 'Proof Studio')
}

function isAutoFolder(dir: string): boolean {
  return /^problem-[a-f0-9]+$/.test(path.basename(dir))
}

function titleFor(dir: string, meta: ProblemMeta): string {
  if (isAutoFolder(dir) && meta.title.trim()) return meta.title
  return path.basename(dir)
}

function adoptLegacyProblems(): void {
  const root = legacyRoot()
  if (!fs.existsSync(root)) return
  const registry = readRegistry()
  let changed = false
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = path.join(root, entry.name)
    const meta = readMeta(dir)
    if (!meta || !/^problem-[a-f0-9]+$/.test(meta.id)) continue
    if (registry[meta.id] === dir) continue
    registry[meta.id] = dir
    changed = true
  }
  if (changed) writeRegistry(registry)
}

function problemDir(id: string): string {
  if (!/^problem-[a-f0-9]+$/.test(id)) throw new Error('Unknown problem.')
  const dir = readRegistry()[id]
  if (!dir) throw new Error('Unknown problem.')
  return dir
}

function registryFile(): string {
  return (
    process.env.PROOF_STUDIO_REGISTRY ??
    path.join(os.homedir(), 'Library', 'Application Support', 'Proof Studio', 'folders.json')
  )
}

function readRegistry(): Record<string, string> {
  try {
    const raw = JSON.parse(fs.readFileSync(registryFile(), 'utf8')) as Record<string, string>
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

function writeRegistry(registry: Record<string, string>): void {
  const file = registryFile()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(registry, null, 2)}\n`)
}

function requireMeta(dir: string): ProblemMeta {
  const meta = readMeta(dir)
  if (!meta) throw new Error('Unknown problem.')
  return meta
}

function readMeta(dir: string): ProblemMeta | null {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'problem.json'), 'utf8')) as ProblemMeta
    if (!raw || typeof raw.id !== 'string' || typeof raw.title !== 'string') return null
    return raw
  } catch {
    return null
  }
}

function writeMeta(dir: string, meta: ProblemMeta): void {
  fs.writeFileSync(path.join(dir, 'problem.json'), `${JSON.stringify(meta, null, 2)}\n`)
}
