import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataset = path.join(root, 'eval', 'dataset')
const proofRoot = path.join(root, 'eval', 'proofs')
const solutionRoot = path.join(root, 'eval', 'solutions')
const limit = 5

function readKey(name: string): string {
  const keyPath = [path.join(root, 'eval', name), path.join(dataset, name)].find((item) => fs.existsSync(item))
  if (!keyPath) throw new Error(`Put the API key in eval/${name}.`)
  const key = fs.readFileSync(keyPath, 'utf8').trim()
  if (!key) throw new Error(`eval/${name} is empty.`)
  return key
}

const museKey = readKey('meta_key')

const proved = new Set(
  (JSON.parse(fs.readFileSync(path.join(root, 'eval', 'results', 'prove.json'), 'utf8')) as { results?: { folder: string; status: string }[] }).results
    ?.filter((item) => item.status === 'ok')
    .map((item) => item.folder) ?? []
)

const filter = process.argv.slice(2)
const folders = [...proved]
  .filter((name) => fs.existsSync(path.join(proofRoot, name, 'proof.lean')))
  .filter((name) => filter.length === 0 || filter.some((item) => name === item || name.startsWith(item)))
  .sort()
if (folders.length === 0) throw new Error('No proved problems matched.')

const { explainProof } = await import('../src/main/muse')
const { compileTexFile } = await import('../src/main/latex')

type Status = 'ok' | 'failed'

type Result = {
  folder: string
  exercise: string
  status: Status
  reason?: string
  seconds: number
}

const resultsPath = path.join(root, 'eval', 'results', 'explain.json')

function loadDone(): Result[] {
  if (!fs.existsSync(resultsPath)) return []
  try {
    const payload = JSON.parse(fs.readFileSync(resultsPath, 'utf8')) as { results?: Result[] }
    return Array.isArray(payload.results) ? payload.results : []
  } catch {
    return []
  }
}

const done = loadDone().filter((item) => folders.includes(item.folder))
const pending = folders.filter((folder) => !done.some((item) => item.folder === folder))
const results: Result[] = [...done]

function save(): void {
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true })
  const finished = [...results].sort((a, b) => a.folder.localeCompare(b.folder))
  const failed = finished.filter((item) => item.status === 'failed').map((item) => item.folder.slice(0, 2))
  const payload = {
    total: folders.length,
    finished: finished.length,
    ok: finished.filter((item) => item.status === 'ok').length,
    failed,
    results: finished
  }
  fs.writeFileSync(resultsPath, JSON.stringify(payload, null, 2) + '\n')
}

function redact(message: string): string {
  return message.split(museKey).join('[key]')
}

function exerciseOf(folder: string): string {
  const metaPath = path.join(dataset, folder, 'meta.json')
  if (!fs.existsSync(metaPath)) return folder
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { source?: string; exercise?: string }
  return [meta.source, meta.exercise].filter(Boolean).join(' ') || folder
}

async function compileSolution(folder: string, tex: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const dir = path.join(solutionRoot, folder)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'solution.tex'), tex.endsWith('\n') ? tex : `${tex}\n`)
  try {
    await compileTexFile(dir, 'solution.tex')
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'pdflatex failed.'
    return { ok: false, message }
  }
}

async function runOne(folder: string): Promise<void> {
  const exercise = exerciseOf(folder)
  const started = Date.now()
  const result: Result = { folder, exercise, status: 'failed', seconds: 0 }
  try {
    const problemPath = path.join(dataset, folder, 'problem.tex')
    if (!fs.existsSync(problemPath)) throw new Error('No problem.tex yet.')
    console.log(`${folder.slice(0, 2)}  ${exercise}  explaining`)
    await explainProof(
      museKey,
      fs.readFileSync(path.join(proofRoot, folder, 'proof.lean'), 'utf8'),
      fs.readFileSync(problemPath, 'utf8'),
      (tex) => compileSolution(folder, tex),
      (progress) => {
        if (progress.phase === 'attempt') console.log(`${folder.slice(0, 2)}  attempt ${progress.attempt}`)
      }
    )
    result.status = 'ok'
    console.log(`${folder.slice(0, 2)}  ok`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The solution failed.'
    result.status = 'failed'
    result.reason = redact(message)
    console.log(`${folder.slice(0, 2)}  failed  ${result.reason}`)
  } finally {
    result.seconds = Math.round((Date.now() - started) / 1000)
    results.push(result)
    save()
  }
}

let next = 0
async function worker(): Promise<void> {
  while (next < pending.length) {
    const folder = pending[next]
    next += 1
    await runOne(folder)
  }
}

console.log(`explaining ${pending.length}, already finished ${done.length}, parallel ${Math.min(limit, pending.length)}`)
await Promise.all(Array.from({ length: Math.min(limit, pending.length) }, () => worker()))
const failed = results.filter((item) => item.status === 'failed')
console.log(`ok ${results.filter((item) => item.status === 'ok').length}/${folders.length}`)
console.log(`failed: ${failed.map((item) => item.folder.slice(0, 2)).join(', ') || 'none'}`)
