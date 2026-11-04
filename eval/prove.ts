import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataset = path.join(root, 'eval', 'dataset')
const leanRoot = path.join(root, 'eval', 'lean')
const proofRoot = path.join(root, 'eval', 'proofs')
const attempts = 4
const limit = 5
const dropped = new Set(['05', '08', '17', '25', '44'])

function readKey(name: string): string {
  const keyPath = [path.join(root, 'eval', name), path.join(dataset, name)].find((item) => fs.existsSync(item))
  if (!keyPath) throw new Error(`Put the API key in eval/${name}.`)
  const key = fs.readFileSync(keyPath, 'utf8').trim()
  if (!key) throw new Error(`eval/${name} is empty.`)
  return key
}

const museKey = readKey('meta_key')

const filter = process.argv.slice(2)
const folders = fs
  .readdirSync(leanRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(leanRoot, entry.name, 'stub.lean')))
  .map((entry) => entry.name)
  .filter((name) => !dropped.has(name.slice(0, 2)))
  .filter((name) => filter.length === 0 || filter.some((item) => name === item || name.startsWith(item)))
  .sort()
if (folders.length === 0) throw new Error('No problem folders matched.')

const { proveStub } = await import('../src/main/muse')
const { installLeanProject } = await import('../src/main/lean')

type Status = 'ok' | 'failed'

type Result = {
  folder: string
  exercise: string
  status: Status
  statement?: number
  reason?: string
  seconds: number
}

const resultsPath = path.join(root, 'eval', 'results', 'prove.json')

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
    attempts,
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

async function saveProof(folder: string, source: string): Promise<void> {
  const dir = path.join(proofRoot, folder)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'proof.lean'), source.endsWith('\n') ? source : `${source}\n`)
  await installLeanProject(dir)
}

async function runOne(folder: string): Promise<void> {
  const exercise = exerciseOf(folder)
  const started = Date.now()
  const result: Result = { folder, exercise, status: 'failed', seconds: 0 }
  try {
    const stubPath = path.join(leanRoot, folder, 'stub.lean')
    console.log(`${folder.slice(0, 2)}  ${exercise}  proving`)
    let proved: number | undefined
    const source = await proveStub(museKey, fs.readFileSync(stubPath, 'utf8'), attempts, (progress) => {
      if (progress.phase === 'attempt') {
        console.log(`${folder.slice(0, 2)}  statement ${progress.statement}, attempt ${progress.attempt}`)
      }
      const round = progress.rounds.at(-1)
      if (progress.phase === 'round' && round?.ok) proved = round.statement
    })
    await saveProof(folder, source)
    result.status = 'ok'
    result.statement = proved
    console.log(`${folder.slice(0, 2)}  ok  statement ${proved ?? '?'}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The proof failed.'
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

console.log(`proving ${pending.length}, already finished ${done.length}, attempts ${attempts}, parallel ${Math.min(limit, pending.length)}`)
await Promise.all(Array.from({ length: Math.min(limit, pending.length) }, () => worker()))
const failed = results.filter((item) => item.status === 'failed')
console.log(`ok ${results.filter((item) => item.status === 'ok').length}/${folders.length}`)
console.log(`failed: ${failed.map((item) => item.folder.slice(0, 2)).join(', ') || 'none'}`)
