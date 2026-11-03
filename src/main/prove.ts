import { PROOF_ATTEMPTS, PROOF_STATEMENTS, type ProveRound } from '../shared/prove'
import { compilerFeedback, extractLean, summarizeLeanFailure, type LeanCompileResult } from './formalize'

export async function proveSource(options: {
  stub: string
  toolchain: string
  ask: (prompt: string) => Promise<string>
  compile: (source: string) => Promise<LeanCompileResult>
  onAttempt?: (statement: number, attempt: number) => void
  onRound?: (round: ProveRound) => void
}): Promise<string> {
  const statements = statementsOf(options.stub)
  if (statements.length === 0) throw new Error('The Lean stub has no statement to prove.')
  let lastOutput = 'lean failed.'
  const failures: string[] = []
  for (let index = 0; index < statements.length; index++) {
    const statement = statements[index]
    const number = index + 1
    let previous: { source: string; output: string } | null = null
    for (let attempt = 1; attempt <= PROOF_ATTEMPTS; attempt++) {
      options.onAttempt?.(number, attempt)
      const raw = await options.ask(provePrompt(options.toolchain, statement, previous))
      const source = extractLean(raw)
      const report = (ok: boolean, detail: string) => {
        options.onRound?.({ statement: number, attempt, ok, returned: oneLine(source), detail })
      }
      if (!source) {
        lastOutput = 'The Lean file was empty.'
        previous = { source: '', output: lastOutput }
        report(false, lastOutput)
        continue
      }
      const shape = proofError(source, statement)
      if (shape) {
        lastOutput = shape
        previous = { source, output: shape }
        report(false, shape)
        continue
      }
      const result = await options.compile(source)
      if (result.ok) {
        report(true, 'Compiled.')
        return source
      }
      lastOutput = result.output
      previous = { source, output: result.output }
      report(false, summarizeLeanFailure(result.output))
    }
    failures.push(`${statement.name} failed after ${PROOF_ATTEMPTS} attempts`)
  }
  throw new Error(`Lean did not accept a proof. ${failures.join('. ')}. ${summarizeLeanFailure(lastOutput)}`)
}

export function statementsOf(source: string): { name: string; file: string }[] {
  const prelude = preludeOf(source)
  return theoremBlocks(source)
    .filter((block) => !/iff/i.test(block.name))
    .slice(0, PROOF_STATEMENTS)
    .map((block) => ({
      name: block.name,
      file: prelude ? `${prelude}\n\n${block.text}\n` : `${block.text}\n`
    }))
}

export function proofError(source: string, statement: { name: string; file: string }): string | null {
  if (/\bsorry\b|\bsorryAx\b/.test(source)) {
    return 'Replace sorry with a complete proof. The file must not contain sorry.'
  }
  if (/^[ \t]*axiom\b/m.test(source)) return 'Do not add an axiom. Write a proof.'
  const blocks = theoremBlocks(source)
  if (!blocks.some((block) => block.name === statement.name)) {
    return `Keep theorem ${statement.name} and prove that statement.`
  }
  const other = blocks.find((block) => /^statement\d+$/.test(block.name) && block.name !== statement.name)
  if (other) return `Prove only ${statement.name}. Do not include ${other.name}.`
  const expected = proposition(statement.file, statement.name)
  const actual = proposition(source, statement.name)
  if (expected && actual !== expected) return `Do not change the statement of ${statement.name}.`
  return null
}

function provePrompt(
  toolchain: string,
  statement: { name: string; file: string },
  previous: { source: string; output: string } | null
): string {
  const version = toolchain.replace('leanprover/lean4:', '')
  const task = `Prove this one Lean 4 theorem for ${toolchain} with Mathlib ${version}.
- Import the specific Mathlib modules you need. Do not write \`import Mathlib\`.
- The file is compiled with \`lake env lean\` in a Lake project that already depends on Mathlib. Do not emit a lakefile or toolchain.
- Prove only ${statement.name}. Do not include another statement of the problem.
- Do not change the theorem name or its statement.
- Replace sorry with a complete proof. Do not use sorry or an axiom.
- Output only Lean source.`
  const parts = [task, `Statement:\n${statement.file.trim()}`]
  if (previous) {
    parts.push(
      `This attempt failed. Prove ${statement.name} again.\n\nLatest reply:\n${cap(previous.source) || '(empty)'}\n\nFeedback:\n${compilerFeedback(previous.output)}`
    )
  }
  return parts.join('\n\n')
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

function proposition(source: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:theorem|lemma)\\s+${escaped}\\b([\\s\\S]*?)\\s*:=`).exec(source)
  if (!match) return null
  return match[1].replace(/\s+/g, ' ').trim()
}

function oneLine(source: string): string {
  const line = source.replace(/\s+/g, ' ').trim()
  if (!line) return '(empty)'
  return line.length > 180 ? `${line.slice(0, 180)}…` : line
}

function cap(source: string): string {
  return source.length > 20_000 ? source.slice(0, 20_000) : source
}
