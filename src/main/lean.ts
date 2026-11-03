import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { leanHasError, type LeanCompileResult } from './formalize'
import { findExecutable, installedLeanRelease } from './toolchain'

const ELAN = path.join(os.homedir(), '.elan', 'bin')
const SEARCH = [ELAN, '/opt/homebrew/bin', '/usr/local/bin']

type LeanProject = {
  dir: string
  lake: string
  toolchain: string
  version: string
}

let setup: Promise<LeanProject> | null = null

export function prepareLean(): Promise<LeanProject> {
  if (!setup) {
    setup = createProject().catch((error: unknown) => {
      setup = null
      throw error
    })
  }
  return setup
}

const ENV_FILES = ['lean-toolchain', 'lakefile.toml', 'lake-manifest.json'] as const

export async function installLeanProject(dir: string): Promise<void> {
  const project = await prepareLean()
  fs.mkdirSync(dir, { recursive: true })
  for (const name of ENV_FILES) {
    fs.copyFileSync(path.join(project.dir, name), path.join(dir, name))
  }
  linkPackages(dir, path.join(project.dir, '.lake', 'packages'))
}

export function removeLeanProject(dir: string): void {
  for (const name of ENV_FILES) {
    const full = path.join(dir, name)
    if (fs.existsSync(full) && fs.statSync(full).isFile()) fs.unlinkSync(full)
  }
  const packages = path.join(dir, '.lake', 'packages')
  const shared = path.join(leanHome(), '.lake', 'packages')
  try {
    if (path.resolve(fs.readlinkSync(packages)) !== path.resolve(shared)) return
  } catch {
    return
  }
  fs.unlinkSync(packages)
  fs.rmSync(path.join(dir, '.lake'), { recursive: true, force: true })
}

export async function compileLeanSource(source: string): Promise<LeanCompileResult> {
  const project = await prepareLean()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proof-studio-lean-'))
  try {
    await installLeanProject(dir)
    fs.writeFileSync(path.join(dir, 'stub.lean'), source)
    const { code, output } = await run(project.lake, ['env', 'lean', 'stub.lean'], dir, project.toolchain, 180_000, 'lean timed out.')
    const cleaned = output.trim()
    if (code === 0 && !leanHasError(cleaned)) return { ok: true }
    return { ok: false, output: cleaned || 'lean failed.' }
  } finally {
    const packages = path.join(dir, '.lake', 'packages')
    if (fs.lstatSync(packages, { throwIfNoEntry: false })?.isSymbolicLink()) fs.unlinkSync(packages)
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

async function createProject(): Promise<LeanProject> {
  const lake = findExecutable('lake', SEARCH)
  const lean = findExecutable('lean', SEARCH)
  if (!lake || !lean) throw new Error('Lean was not found. Install Lean and try again.')
  const installed = installedRelease()
  const { version, toolchain } = installed
  const dir = leanHome()
  fs.mkdirSync(dir, { recursive: true })

  const toolchainFile = path.join(dir, 'lean-toolchain')
  const lakefile = path.join(dir, 'lakefile.toml')
  const manifest = path.join(dir, 'lake-manifest.json')
  const stampFile = path.join(dir, '.proof-studio-ready')
  const desiredToolchain = `${toolchain}\n`
  const desiredLakefile = lakefileFor(version)
  const toolchainMatches = readIfExists(toolchainFile) === desiredToolchain
  const lakefileMatches = readIfExists(lakefile) === desiredLakefile
  if (!toolchainMatches || !lakefileMatches) {
    fs.writeFileSync(toolchainFile, desiredToolchain)
    fs.writeFileSync(lakefile, desiredLakefile)
    if (fs.existsSync(manifest)) fs.rmSync(manifest)
    if (fs.existsSync(stampFile)) fs.rmSync(stampFile)
  }

  if (!fs.existsSync(manifest)) {
    const updated = await run(lake, ['update'], dir, toolchain, 20 * 60_000, 'Setting up Mathlib timed out.')
    if (updated.code !== 0 || !fs.existsSync(manifest)) {
      throw new Error(`Setting up Mathlib failed. ${tail(updated.output)}`)
    }
  }

  if (readIfExists(stampFile) !== desiredToolchain) {
    const cached = await run(lake, ['exe', 'cache', 'get'], dir, toolchain, 30 * 60_000, 'Setting up Mathlib timed out.')
    if (cached.code !== 0) throw new Error(`Setting up Mathlib failed. ${tail(cached.output)}`)
    fs.writeFileSync(stampFile, desiredToolchain)
  }

  return { dir, lake, toolchain, version }
}

function installedRelease(): { toolchain: string; version: string } {
  const found = installedLeanRelease()
  if (!found) throw new Error('Lean was not found. Install Lean and try again.')
  return found
}

function linkPackages(dir: string, target: string): void {
  const packages = path.join(dir, '.lake', 'packages')
  fs.mkdirSync(path.dirname(packages), { recursive: true })
  try {
    const stat = fs.lstatSync(packages)
    if (!stat.isSymbolicLink()) return
    if (path.resolve(fs.readlinkSync(packages)) === path.resolve(target)) return
    fs.unlinkSync(packages)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  fs.symlinkSync(target, packages)
}

function leanHome(): string {
  return process.env.PROOF_STUDIO_LEAN ?? path.join(os.homedir(), 'Library', 'Application Support', 'Proof Studio', 'lean')
}

function lakefileFor(version: string): string {
  return `name = "proofstudio"
version = "0.1.0"

[[require]]
name = "mathlib"
git = "https://github.com/leanprover-community/mathlib4.git"
rev = "v${version}"
`
}

function readIfExists(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

function tail(output: string): string {
  const text = output.trim().split('\n').slice(-4).join(' ').replace(/\s+/g, ' ').trim()
  return text.slice(0, 500) || 'lake failed.'
}

function run(
  bin: string,
  args: string[],
  cwd: string,
  toolchain: string,
  timeoutMs: number,
  timeoutMessage: string
): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd,
      env: {
        ...process.env,
        ELAN_TOOLCHAIN: toolchain,
        PATH: `${path.dirname(bin)}${path.delimiter}${ELAN}${path.delimiter}${process.env.PATH ?? ''}`
      }
    })
    let output = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(timeoutMessage))
    }, timeoutMs)
    const take = (chunk: Buffer) => {
      output += chunk.toString()
      if (output.length > 200_000) output = output.slice(-200_000)
    }
    child.stdout.on('data', take)
    child.stderr.on('data', take)
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
