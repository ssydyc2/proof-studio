import { PROOF_ATTEMPTS, PROOF_STATEMENTS, proofAttemptCount, type ProveRound } from '../shared/prove'
import { compilerFeedback, extractLean, summarizeLeanFailure, type LeanCompileResult } from './formalize'

export async function proveSource(options: {
  stub: string
  toolchain: string
  attempts?: number
  ask: (prompt: string) => Promise<string>
  compile: (source: string) => Promise<LeanCompileResult>
  onAttempt?: (statement: number, attempt: number) => void
  onRunning?: (running: { statement: number; attempt: number }[]) => void
  onRound?: (round: ProveRound) => void
}): Promise<string> {
  const attempts = proofAttemptCount(options.attempts ?? PROOF_ATTEMPTS)
  const statements = statementsOf(options.stub)
  if (statements.length === 0) throw new Error('The Lean stub has no statement to prove.')
  let lastOutput = 'lean failed.'
  let winner: string | null = null
  let compileChain = Promise.resolve()
  const failures: string[] = []
  const active = new Map<number, number>()
  const publishActive = () => {
    const running = [...active.entries()]
      .map(([statement, attempt]) => ({ statement, attempt }))
      .sort((left, right) => left.statement - right.statement)
    options.onRunning?.(running)
  }
  const compileIfOpen = (source: string) => {
    const run = compileChain.then(async () => {
      if (winner != null) return null
      const result = await options.compile(source)
      if (result.ok) {
        if (winner != null) return null
        winner = source
      }
      return result
    })
    compileChain = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  async function proveStatement(statement: { name: string; file: string }, number: number): Promise<void> {
    const history: { source: string; output: string }[] = []
    try {
      for (let attempt = 1; attempt <= attempts; attempt++) {
        if (winner != null) return
        active.set(number, attempt)
        publishActive()
        options.onAttempt?.(number, attempt)
        const raw = await options.ask(provePrompt(options.toolchain, statement, history))
        if (winner != null) return
        const source = extractLean(raw)
        const report = (ok: boolean, detail: string) => {
          options.onRound?.({ statement: number, attempt, ok, returned: oneLine(source), detail })
        }
        if (!source) {
          lastOutput = 'The Lean file was empty.'
          history.push({ source: '', output: lastOutput })
          report(false, lastOutput)
          continue
        }
        const shape = proofError(source, statement)
        if (shape) {
          lastOutput = shape
          history.push({ source, output: shape })
          report(false, shape)
          continue
        }
        const result = await compileIfOpen(source)
        if (result == null) return
        if (result.ok) {
          report(true, 'Compiled.')
          return
        }
        lastOutput = result.output
        history.push({ source, output: result.output })
        report(false, compilerFeedback(result.output))
      }
      if (winner != null) return
      const attemptWord = attempts === 1 ? 'attempt' : 'attempts'
      failures.push(`${statement.name} failed after ${attempts} ${attemptWord}`)
    } finally {
      active.delete(number)
      publishActive()
    }
  }

  await Promise.all(statements.map((statement, index) => proveStatement(statement, index + 1)))
  if (winner) return winner
  failures.sort((left, right) => left.localeCompare(right))
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
  history: { source: string; output: string }[]
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
  if (history.length > 0) {
    const records = history.map(
      (item, index) =>
        `Attempt ${index + 1}:\nReply:\n${cap(item.source) || '(empty)'}\n\nFeedback:\n${compilerFeedback(item.output)}`
    )
    parts.push(`Earlier attempts failed. Prove ${statement.name} again. Do not repeat these errors.\n\n${records.join('\n\n')}`)
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
