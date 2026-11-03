import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pdfKeyFor, type TexSourceKey } from '../shared/problem'
import { pdflatexCommand } from './toolchain'
import { clearStepError, problemDirectory, readFile, recordProblemError } from './workspace'

const TEX_NAME: Record<TexSourceKey, string> = {
  problemText: 'problem.tex',
  solutionTex: 'solution.tex'
}

const chains = new Map<string, Promise<void>>()

export function compileTex(id: string, sourceKey: TexSourceKey): Promise<void> {
  const key = `${id}\n${sourceKey}`
  const previous = chains.get(key) ?? Promise.resolve()
  const run = previous.catch(() => undefined).then(() => compileTexOnce(id, sourceKey))
  chains.set(key, run)
  void run.finally(() => {
    if (chains.get(key) === run) chains.delete(key)
  }).catch(() => undefined)
  return run
}

async function compileTexOnce(id: string, sourceKey: TexSourceKey): Promise<void> {
  const texName = TEX_NAME[sourceKey]
  const pdfKey = pdfKeyFor(sourceKey)
  const dir = problemDirectory(id)
  if (!fs.existsSync(path.join(dir, texName))) {
    throw new Error(sourceKey === 'problemText' ? 'No problem text yet.' : 'No solution TeX yet.')
  }

  try {
    await compileTexFile(dir, texName)
    clearStepError(id, pdfKey)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'pdflatex failed.'
    if (readFile(id, pdfKey).kind !== 'pdf') recordProblemError(id, pdfKey, message)
    throw error instanceof Error ? error : new Error(message)
  }
}

export async function compileTexFile(dir: string, texName: string): Promise<void> {
  const texPath = path.join(dir, texName)
  if (!fs.existsSync(texPath)) throw new Error(`No TeX file at ${texName}.`)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'proof-studio-'))
  try {
    const { code, output } = await runPdflatex(texName, dir, tmp)
    const produced = path.join(tmp, texName.replace(/\.tex$/, '.pdf'))
    if (code !== 0 || !fs.existsSync(produced)) throw new Error(latexMessage(output))
    fs.copyFileSync(produced, path.join(dir, path.basename(produced)))
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

function latexMessage(output: string): string {
  const line = output.split('\n').find((item) => item.startsWith('!') || /:\d+:/.test(item))
  const text = (line ?? 'pdflatex failed.').replace(/^!\s*/, '').trim()
  return text.slice(0, 500) || 'pdflatex failed.'
}

function runPdflatex(texName: string, cwd: string, outputDirectory: string): Promise<{ code: number; output: string }> {
  const bin = pdflatexCommand()
  return new Promise((resolve, reject) => {
    const child = spawn(
      bin,
      ['-interaction=nonstopmode', '-halt-on-error', '-file-line-error', `-output-directory=${outputDirectory}`, texName],
      {
        cwd,
        env: {
          ...process.env,
          PATH: `${path.dirname(bin)}${path.delimiter}/Library/TeX/texbin${path.delimiter}${process.env.PATH ?? ''}`
        }
      }
    )
    let output = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('pdflatex timed out.'))
    }, 60_000)
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, output })
    })
  })
}
