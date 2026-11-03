import { FORMALIZE_ATTEMPTS, type FormalizeRound } from '../shared/formalize'

export type LeanCompileResult = { ok: true } | { ok: false; output: string }

export async function formalizeSource(options: {
  tex: string
  toolchain: string
  ask: (prompt: string) => Promise<string>
  compile: (source: string) => Promise<LeanCompileResult>
  onAttempt?: (attempt: number, statement: number) => void
  onRound?: (round: FormalizeRound) => void
}): Promise<string> {
  let accepted: string | null = null
  let latest: { source: string; output: string } | null = null
  let statement = 1
  let lastOutput = 'lean failed.'
  for (let attempt = 1; attempt <= FORMALIZE_ATTEMPTS; attempt++) {
    options.onAttempt?.(attempt, statement)
    const raw = await options.ask(
      formalizePrompt(options.tex, options.toolchain, statement, latest ? { accepted, latest } : null)
    )
    const source = extractLean(raw)
    const report = (ok: boolean, detail: string) => {
      options.onRound?.({ attempt, ok, returned: oneLine(source), detail })
    }
    if (!source) {
      lastOutput = 'The Lean file was empty.'
      latest = { source: '', output: lastOutput }
      report(false, lastOutput)
      continue
    }
    const combined = nextFormulation(accepted, source)
    if (!combined.ok) {
      lastOutput = combined.output
      latest = { source, output: lastOutput }
      report(false, lastOutput)
      continue
    }
    const result = await options.compile(combined.source)
    if (result.ok) {
      accepted = combined.source
      latest = { source: combined.source, output: '' }
      if (statement < FORMALIZE_ATTEMPTS) statement += 1
      report(true, 'Compiled.')
      continue
    }
    lastOutput = result.output
    latest = { source, output: result.output }
    report(false, summarizeLeanFailure(result.output))
  }
  if (accepted) return accepted
  throw new Error(
    `Lean did not accept a formulation after ${FORMALIZE_ATTEMPTS} attempts. ${summarizeLeanFailure(lastOutput)}`
  )
}

export function nextFormulation(
  accepted: string | null,
  source: string
): { ok: true; source: string } | { ok: false; output: string } {
  const blocks = theoremBlocks(source)
  if (blocks.some((block) => /iff/i.test(block.name) || linksSavedTheorem(block.text, accepted))) {
    return {
      ok: false,
      output: 'Do not add an iff theorem. Write one new statement of the problem, proved by sorry.'
    }
  }
  const saved = new Set(theoremBlocks(accepted ?? '').map((block) => block.name))
  const fresh = blocks.filter((block) => !saved.has(block.name))
  const chosen = fresh[0]
  if (!chosen) {
    return { ok: false, output: 'Add one new statement other than the theorems already saved. The proof is sorry.' }
  }
  if (!/\bsorry\b/.test(chosen.text)) return { ok: false, output: 'The new statement must be proved by sorry.' }
  if (!accepted) {
    const prelude = preludeOf(source)
    return { ok: true, source: prelude ? `${prelude}\n\n${chosen.text}` : chosen.text }
  }
  return { ok: true, source: `${accepted.trim()}\n\n${chosen.text}` }
}

function linksSavedTheorem(text: string, accepted: string | null): boolean {
  if (!accepted || !/↔/.test(text)) return false
  return theoremBlocks(accepted).some((block) => new RegExp(`\\b${block.name.replace(/\./g, '\\.')}\\b`).test(text))
}

function theoremBlocks(source: string): { name: string; text: string }[] {
  const matches = [...source.matchAll(/^[ \t]*(?:theorem|lemma)\s+([A-Za-z0-9_'.]+)/gm)]
  return matches.map((match, index) => {
    const start = match.index ?? 0
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? source.length) : source.length
    return { name: match[1], text: source.slice(start, end).trim() }
  })
}

function preludeOf(source: string): string {
  const match = /^[ \t]*(?:theorem|lemma)\s+/m.exec(source)
  if (!match || match.index == null) return ''
  return source.slice(0, match.index).trim()
}

function oneLine(source: string): string {
  const line = source.replace(/\s+/g, ' ').trim()
  if (!line) return '(empty)'
  return line.length > 180 ? `${line.slice(0, 180)}…` : line
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
  statement: number,
  context: { accepted: string | null; latest: { source: string; output: string } } | null
): string {
  const version = toolchain.replace('leanprover/lean4:', '')
  const shared = `Write Lean 4 for ${toolchain} with Mathlib ${version}.
- Import the specific Mathlib modules you need. Do not write \`import Mathlib\`.
- The file is compiled with \`lake env lean\` in a Lake project that already depends on Mathlib. Do not emit a lakefile or toolchain.
- Do not solve the problem.
- Do not write an iff theorem, an equivalence, or a theorem whose name contains iff.
- The proof is sorry.
- Output only Lean source.`
  const task =
    statement === 1
      ? `Write theorem statement1 for the problem. One theorem only.`
      : `The file below compiled. Append theorem statement2 onto it.
- statement2 is a different Lean statement of the same problem, other than the theorems already saved.
- Output the complete file with the saved theorems unchanged and statement2 appended. You may instead output only statement2.`
  const parts = [`${shared}\n${task}`, `Problem:\n${tex.trim()}`]
  if (context?.accepted) parts.push(`Lean file so far, which compiled:\n${cap(context.accepted)}`)
  if (context && context.latest.source !== context.accepted) {
    parts.push(
      `This attempt failed. Write statement${statement} again.\n\nLatest reply:\n${cap(context.latest.source) || '(empty)'}\n\nFeedback:\n${compilerFeedback(context.latest.output)}`
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
