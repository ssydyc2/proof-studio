import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataset = path.join(root, 'eval', 'dataset')
const leanRoot = path.join(root, 'eval', 'lean')

function readKey(name: string): string {
  const keyPath = [path.join(root, 'eval', name), path.join(dataset, name)].find((item) => fs.existsSync(item))
  if (!keyPath) throw new Error(`Put the API key in eval/${name}.`)
  const key = fs.readFileSync(keyPath, 'utf8').trim()
  if (!key) throw new Error(`eval/${name} is empty.`)
  return key
}

const museKey = readKey('meta_key')
const glmKey = readKey('glm_key')

const filter = process.argv.slice(2)
const folders = fs
  .readdirSync(dataset, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(dataset, entry.name, 'source.png')))
  .map((entry) => entry.name)
  .filter((name) => filter.length === 0 || filter.some((item) => name === item || name.startsWith(item)))
  .sort()
if (folders.length === 0) throw new Error('No problem folders matched.')

const { formalizeTex } = await import('../src/main/muse')
const { installLeanProject } = await import('../src/main/lean')
const { judgeFormalization } = await import('./glm')

type Status = 'ok' | 'missing' | 'compile' | 'mismatch'

type Result = {
  folder: string
  exercise: string
  status: Status
  statements: number
  reason?: string
  seconds: number
}

const resultsPath = path.join(root, 'eval', 'results', 'formalize.json')

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
  const ids = (status: Status) => finished.filter((item) => item.status === status).map((item) => item.exercise)
  const payload = {
    total: folders.length,
    finished: finished.length,
    ok: finished.filter((item) => item.status === 'ok').length,
    missingTwo: ids('missing'),
    compileFailed: ids('compile'),
    mismatch: ids('mismatch'),
    results: finished
  }
  fs.writeFileSync(resultsPath, JSON.stringify(payload, null, 2) + '\n')
}

function redact(message: string): string {
  return message.split(museKey).join('[key]').split(glmKey).join('[key]')
}

function exerciseOf(folder: string): string {
  const metaPath = path.join(dataset, folder, 'meta.json')
  if (!fs.existsSync(metaPath)) return folder
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { source?: string; exercise?: string }
  return [meta.source, meta.exercise].filter(Boolean).join(' ') || folder
}

function statementCount(source: string): number {
  return [...source.matchAll(/^[ \t]*(?:theorem|lemma)\s+[A-Za-z0-9_'.]+/gm)].length
}

async function saveLean(folder: string, source: string): Promise<void> {
  const dir = path.join(leanRoot, folder)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'stub.lean'), source.endsWith('\n') ? source : `${source}\n`)
  await installLeanProject(dir)
}

async function runOne(folder: string): Promise<void> {
  const dir = path.join(dataset, folder)
  const exercise = exerciseOf(folder)
  const started = Date.now()
  const result: Result = { folder, exercise, status: 'compile', statements: 0, seconds: 0 }
  try {
    const texPath = path.join(dir, 'problem.tex')
    if (!fs.existsSync(texPath)) throw new Error('No problem.tex yet.')
    console.log(`${exercise}  generating`)
    const source = await formalizeTex(museKey, fs.readFileSync(texPath, 'utf8'), (progress) => {
      if (progress.phase === 'attempt') console.log(`${exercise}  statement ${progress.statement}, attempt ${progress.attempt}`)
    })
    await saveLean(folder, source)
    result.statements = statementCount(source)
    if (result.statements < 2) {
      result.status = 'missing'
      result.reason = `Compiled with ${result.statements} statement${result.statements === 1 ? '' : 's'}.`
      console.log(`${exercise}  missing  ${result.reason}`)
    } else {
      const verdict = await judgeFormalization(glmKey, fs.readFileSync(path.join(dir, 'source.png')), source)
      result.status = verdict.same ? 'ok' : 'mismatch'
      result.reason = verdict.reason
      console.log(`${exercise}  ${result.status}  ${verdict.reason}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Formalization failed.'
    result.status = 'compile'
    result.reason = redact(message)
    console.log(`${exercise}  compile  ${result.reason}`)
  } finally {
    result.seconds = Math.round((Date.now() - started) / 1000)
    results.push(result)
    save()
  }
}

const limit = 10
let next = 0
async function worker(): Promise<void> {
  while (next < pending.length) {
    const folder = pending[next]
    next += 1
    await runOne(folder)
  }
}

console.log(`resuming ${pending.length}, already finished ${done.length}, parallel ${limit}`)
await Promise.all(Array.from({ length: Math.min(limit, pending.length) }, () => worker()))
const missing = results.filter((item) => item.status === 'missing')
const compile = results.filter((item) => item.status === 'compile')
const mismatch = results.filter((item) => item.status === 'mismatch')
console.log(`ok ${results.filter((item) => item.status === 'ok').length}/${folders.length}`)
console.log(`missing two: ${missing.map((item) => item.exercise).join(', ') || 'none'}`)
console.log(`compile failed: ${compile.map((item) => item.exercise).join(', ') || 'none'}`)
console.log(`mismatch: ${mismatch.map((item) => item.exercise).join(', ') || 'none'}`)
