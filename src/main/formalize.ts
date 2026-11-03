import { FORMALIZE_ATTEMPTS } from '../shared/formalize'

export type LeanCompileResult = { ok: true } | { ok: false; output: string }

export async function formalizeSource(options: {
  tex: string
  toolchain: string
  ask: (prompt: string) => Promise<string>
  compile: (source: string) => Promise<LeanCompileResult>
  onAttempt?: (attempt: number) => void
}): Promise<string> {
  let accepted: string | null = null
  let latest: { source: string; output: string } | null = null
  let lastOutput = 'lean failed.'
  for (let attempt = 1; attempt <= FORMALIZE_ATTEMPTS; attempt++) {
    options.onAttempt?.(attempt)
    const raw = await options.ask(
      formalizePrompt(options.tex, options.toolchain, attempt, latest ? { accepted, latest } : null)
    )
    const source = extractLean(raw)
    if (!source) {
      lastOutput = 'The Lean file was empty.'
      latest = { source: '', output: lastOutput }
      continue
    }
    const shape = formulationError(source, attempt)
    if (shape) {
      lastOutput = shape
      latest = { source, output: lastOutput }
      continue
    }
    const result = await options.compile(source)
    if (result.ok) {
      accepted = source
      latest = { source, output: '' }
      continue
    }
    lastOutput = result.output
    latest = { source, output: result.output }
  }
  if (accepted) return accepted
  throw new Error(
    `Lean did not accept a formulation after ${FORMALIZE_ATTEMPTS} attempts. ${summarizeLeanFailure(lastOutput)}`
  )
}

export function formulationError(source: string, formulations: number): string | null {
  const sorries = source.match(/\bsorry\b/g)?.length ?? 0
  if (sorries !== formulations) {
    return `This round must add formulation ${formulations}. The file needs exactly ${formulations} sorry proofs and no other proofs.`
  }
  return null
}

export function extractLean(text: string): string {
  const blocks = [...text.matchAll(/```(?:lean4?|lean)?\s*([\s\S]*?)```/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean)
  if (blocks.length > 0) return blocks.sort((a, b) => b.length - a.length)[0]
  return text.trim()
}

export function compilerFeedback(output: string): string {
  const lines = stripAnsi(output).split('\n')
  const picked: string[] = []
  for (let index = 0; index < lines.length; index++) {
    if (!isLeanError(lines[index])) continue
    picked.push(lines[index].trimEnd())
    for (let follow = index + 1; follow < lines.length && follow < index + 6; follow++) {
      if (isLeanError(lines[follow])) break
      if (lines[follow].trim()) picked.push(lines[follow].trimEnd())
    }
  }
  const text = (picked.length > 0 ? picked.join('\n') : stripAnsi(output)).trim()
  return text.slice(0, 8000) || 'lean failed.'
}

export function summarizeLeanFailure(output: string): string {
  const cleaned = stripAnsi(output)
  const line = cleaned.split('\n').find((item) => isLeanError(item)) ?? cleaned.trim().split('\n')[0]
  const text = (line ?? 'lean failed.').replace(/^.*?stub\.lean:\d+:\d+:\s*/, '').trim()
  return text.slice(0, 500) || 'lean failed.'
}

export function leanHasError(output: string): boolean {
  return stripAnsi(output).split('\n').some((line) => isLeanError(line))
}

function formalizePrompt(
  tex: string,
  toolchain: string,
  round: number,
  context: { accepted: string | null; latest: { source: string; output: string } } | null
): string {
  const version = toolchain.replace('leanprover/lean4:', '')
  const shared = `Write one Lean 4 file for ${toolchain} with Mathlib ${version}.
- Import the specific Mathlib modules you need. Do not write \`import Mathlib\`.
- The file is compiled with \`lake env lean\` in a Lake project that already depends on Mathlib. Do not emit a lakefile or toolchain.
- Do not solve the problem, and do not prove that the formulations match. No equivalence theorems.
- Output only the Lean source.`
  const task =
    round === 1
      ? `This is formulation 1 of 3.
- theorem statement1 states the problem and is proved by sorry.
- The file contains exactly one sorry.`
      : round === 2
        ? `This is formulation 2 of 3. Keep statement1.
- theorem statement2 is a different Lean statement of the same problem, proved by sorry.
- The file contains exactly two sorries.`
        : `This is formulation 3 of 3. Keep the formulations that already compile.
- theorem statement3 is another Lean statement of the same problem, proved by sorry.
- The file contains exactly three sorries.`
  const parts = [`${shared}\n${task}`, `Problem:\n${tex.trim()}`]
  if (context?.accepted) parts.push(`Lean file so far, which compiled:\n${cap(context.accepted)}`)
  if (context && context.latest.source !== context.accepted) {
    parts.push(
      `The latest attempt failed. Repair it where you can, and still add this formulation.\n\nLatest file:\n${cap(context.latest.source) || '(empty)'}\n\nFeedback:\n${compilerFeedback(context.latest.output)}`
    )
  }
  return parts.join('\n\n')
}

function cap(source: string): string {
  return source.length > 20_000 ? source.slice(0, 20_000) : source
}

function isLeanError(line: string): boolean {
  return /\berror(?:\(|:)/.test(line)
}

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '')
}
