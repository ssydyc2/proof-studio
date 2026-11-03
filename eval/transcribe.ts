import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataset = path.join(root, 'eval', 'dataset')
const keyPath = [path.join(root, 'eval', 'meta_key'), path.join(dataset, 'meta_key')].find((item) => fs.existsSync(item))
if (!keyPath) throw new Error('Put the API key in eval/meta_key.')
const key = fs.readFileSync(keyPath, 'utf8').trim()
if (!key) throw new Error('The API key file is empty.')

const filter = process.argv.slice(2)
const folders = fs
  .readdirSync(dataset, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(dataset, entry.name, 'source.png')))
  .map((entry) => entry.name)
  .filter((name) => filter.length === 0 || filter.some((item) => name === item || name.startsWith(item)))
  .sort()
if (folders.length === 0) throw new Error('No problem folders matched.')

const { transcribeScreenshot } = await import('../src/main/muse')
const { compileTexFile } = await import('../src/main/latex')

type Result = {
  folder: string
  tex: boolean
  pdf: boolean
  error?: string
  seconds: number
}

const results: Result[] = []
const resultsPath = path.join(root, 'eval', 'results', 'transcribe.json')

function save(): void {
  fs.mkdirSync(path.dirname(resultsPath), { recursive: true })
  const finished = [...results].sort((a, b) => a.folder.localeCompare(b.folder))
  const payload = {
    total: folders.length,
    finished: finished.length,
    compiled: finished.filter((item) => item.pdf).length,
    results: finished
  }
  fs.writeFileSync(resultsPath, JSON.stringify(payload, null, 2) + '\n')
}

function redact(message: string): string {
  return message.split(key).join('[key]')
}

async function runOne(folder: string): Promise<void> {
  const dir = path.join(dataset, folder)
  const started = Date.now()
  const result: Result = { folder, tex: false, pdf: false, seconds: 0 }
  try {
    const bytes = fs.readFileSync(path.join(dir, 'source.png'))
    const tex = await transcribeScreenshot(key, bytes, 'image/png')
    fs.writeFileSync(path.join(dir, 'problem.tex'), tex.endsWith('\n') ? tex : `${tex}\n`)
    result.tex = true
    await compileTexFile(dir, 'problem.tex')
    const pdf = fs.readFileSync(path.join(dir, 'problem.pdf'))
    if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('problem.pdf is not a PDF.')
    result.pdf = true
    console.log(`${folder}  compiled`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The transcription failed.'
    result.error = redact(message)
    console.log(`${folder}  failed  ${result.error}`)
  } finally {
    result.seconds = Math.round((Date.now() - started) / 1000)
    results.push(result)
    save()
  }
}

const limit = 4
let next = 0
async function worker(): Promise<void> {
  while (next < folders.length) {
    const folder = folders[next]
    next += 1
    await runOne(folder)
  }
}

await Promise.all(Array.from({ length: Math.min(limit, folders.length) }, () => worker()))
const compiled = results.filter((item) => item.pdf).length
const texOnly = results.filter((item) => item.tex && !item.pdf).length
console.log(`compiled ${compiled}/${folders.length}, tex only ${texOnly}`)
