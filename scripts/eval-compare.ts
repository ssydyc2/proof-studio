import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
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

const { judgeProblemImages } = await import('../src/main/muse')

type Result = {
  folder: string
  same: boolean | null
  reason?: string
  error?: string
  seconds: number
}

const results: Result[] = []
const resultsPath = path.join(root, 'eval', 'compare-results.json')

function save(): void {
  const finished = [...results].sort((a, b) => a.folder.localeCompare(b.folder))
  const payload = {
    total: folders.length,
    finished: finished.length,
    same: finished.filter((item) => item.same === true).length,
    different: finished.filter((item) => item.same === false).length,
    failed: finished.filter((item) => item.same === null).length,
    results: finished
  }
  fs.writeFileSync(resultsPath, JSON.stringify(payload, null, 2) + '\n')
}

function redact(message: string): string {
  return message.split(key).join('[key]')
}

function renderPdf(pdfPath: string): Promise<Buffer[]> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'proof-studio-compare-'))
  const output = path.join(tmp, 'page-%d.png')
  return new Promise((resolve, reject) => {
    const child = spawn(
      'gs',
      ['-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=png16m', '-r144', `-sOutputFile=${output}`, pdfPath],
      { stdio: 'ignore' }
    )
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Rendering the PDF timed out.'))
    }, 30_000)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        fs.rmSync(tmp, { recursive: true, force: true })
        reject(new Error('Could not render the PDF.'))
        return
      }
      const pages = fs
        .readdirSync(tmp)
        .filter((name) => name.endsWith('.png'))
        .sort()
        .map((name) => fs.readFileSync(path.join(tmp, name)))
      fs.rmSync(tmp, { recursive: true, force: true })
      resolve(pages)
    })
  })
}

async function runOne(folder: string): Promise<void> {
  const dir = path.join(dataset, folder)
  const started = Date.now()
  const result: Result = { folder, same: null, seconds: 0 }
  try {
    const pdfPath = path.join(dir, 'problem.pdf')
    if (!fs.existsSync(pdfPath)) throw new Error('No problem.pdf yet.')
    const pages = await renderPdf(pdfPath)
    const verdict = await judgeProblemImages(key, fs.readFileSync(path.join(dir, 'source.png')), pages)
    result.same = verdict.same
    result.reason = verdict.reason
    console.log(`${folder}  ${verdict.same ? 'same' : 'different'}  ${verdict.reason}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The comparison failed.'
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
const same = results.filter((item) => item.same === true).length
const different = results.filter((item) => item.same === false).length
const failed = results.filter((item) => item.same === null).length
console.log(`same ${same}/${folders.length}, different ${different}, failed ${failed}`)
