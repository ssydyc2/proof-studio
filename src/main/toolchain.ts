import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ToolId, ToolStatus } from '../shared/toolchain'

const TEXBIN = '/Library/TeX/texbin'

const INSTALL_URL: Record<ToolId, string> = {
  tex: 'https://www.tug.org/mactex/',
  lean: 'https://lean-lang.org/install/'
}

const TOOLS: Record<ToolId, { command: string; label: string; hint: string; directories: string[] }> = {
  tex: {
    command: 'pdflatex',
    label: 'TeX',
    hint: 'Install MacTeX to build PDFs.',
    directories: [TEXBIN, '/opt/homebrew/bin', '/usr/local/bin']
  },
  lean: {
    command: 'lean',
    label: 'Lean',
    hint: 'Install Lean to build proofs.',
    directories: [path.join(os.homedir(), '.elan', 'bin'), '/opt/homebrew/bin', '/usr/local/bin']
  }
}

export function installUrl(id: ToolId): string {
  return INSTALL_URL[id]
}

export function findExecutable(name: string, directories: string[]): string | null {
  const dirs = [...directories, ...(process.env.PATH ?? '').split(path.delimiter).filter(Boolean)]
  const seen = new Set<string>()
  for (const dir of dirs) {
    if (seen.has(dir)) continue
    seen.add(dir)
    const candidate = path.join(dir, name)
    try {
      if (fs.statSync(candidate).isFile()) return candidate
    } catch {
      // This directory does not contain the command.
    }
  }
  return null
}

export function pdflatexCommand(): string {
  const found = findExecutable('pdflatex', TOOLS.tex.directories)
  if (!found) throw new Error('pdflatex was not found. Install MacTeX and try again.')
  return found
}

export function installedLeanRelease(
  root = path.join(os.homedir(), '.elan', 'toolchains')
): { toolchain: string; version: string } | null {
  let names: string[] = []
  try {
    names = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch {
    names = []
  }
  const found = names
    .map(decodeToolchain)
    .filter((item): item is { toolchain: string; version: string } => item != null)
    .sort((a, b) => compareVersion(b.version, a.version))
  return found[0] ?? null
}

function decodeToolchain(dirName: string): { toolchain: string; version: string } | null {
  const toolchain = dirName.replace('---', ':').replace('--', '/')
  const match = toolchain.match(/:v(\d+\.\d+\.\d+)$/)
  if (!match) return null
  return { toolchain, version: match[1] }
}

function compareVersion(left: string, right: string): number {
  const a = left.split('.').map(Number)
  const b = right.split('.').map(Number)
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) return a[index] - b[index]
  }
  return 0
}

export async function toolchainStatus(): Promise<ToolStatus[]> {
  return Promise.all(
    (Object.keys(TOOLS) as ToolId[]).map(async (id) => {
      const tool = TOOLS[id]
      const bin = findExecutable(tool.command, tool.directories)
      if (!bin) {
        return { id, label: tool.label, ready: false, detail: 'Not found', hint: tool.hint }
      }
      const leanRelease = id === 'lean' ? installedLeanRelease() : null
      if (id === 'lean' && bin.includes(`${path.sep}.elan${path.sep}`) && !leanRelease) {
        return { id, label: tool.label, ready: false, detail: 'Not found', hint: tool.hint }
      }
      try {
        const detail = await versionOf(bin, leanRelease?.toolchain)
        return { id, label: tool.label, ready: true, detail, hint: tool.hint }
      } catch {
        return { id, label: tool.label, ready: false, detail: 'Not found', hint: tool.hint }
      }
    })
  )
}

function versionOf(bin: string, toolchain?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ['--version'], {
      env: {
        ...process.env,
        ...(toolchain ? { ELAN_TOOLCHAIN: toolchain } : {}),
        PATH: `${path.dirname(bin)}${path.delimiter}${process.env.PATH ?? ''}`
      }
    })
    let output = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('timed out'))
    }, 8_000)
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
      const line = output.split('\n').map((item) => item.trim()).find(Boolean)
      if (code !== 0 || !line) reject(new Error(line ?? 'failed'))
      else resolve(line.slice(0, 120))
    })
  })
}
