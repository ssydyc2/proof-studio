import { EXPLAIN_ATTEMPTS, type ExplainRound } from '../shared/explain'
import { ensureLatexDocument } from '../shared/problem'

export async function explainSource(options: {
  lean: string
  problem: string
  ask: (prompt: string) => Promise<string>
  compile: (tex: string) => Promise<{ ok: true } | { ok: false; message: string }>
  onAttempt?: (attempt: number) => void
  onRound?: (round: ExplainRound) => void
}): Promise<string> {
  let latest: { tex: string; message: string } | null = null
  let lastMessage = 'pdflatex failed.'
  for (let attempt = 1; attempt <= EXPLAIN_ATTEMPTS; attempt++) {
    options.onAttempt?.(attempt)
    const tex = ensureLatexDocument(extractTex(await options.ask(explainPrompt(options.lean, options.problem, latest))))
    if (!tex.trim()) {
      lastMessage = 'The solution TeX was empty.'
      latest = { tex: '', message: lastMessage }
      options.onRound?.({ attempt, ok: false, detail: lastMessage })
      continue
    }
    const result = await options.compile(tex)
    if (result.ok) {
      options.onRound?.({ attempt, ok: true, detail: 'Compiled.' })
      return tex
    }
    lastMessage = result.message
    latest = { tex, message: result.message }
    options.onRound?.({ attempt, ok: false, detail: result.message })
  }
  throw new Error(`The solution TeX did not compile after ${EXPLAIN_ATTEMPTS} attempts. ${lastMessage}`)
}

export function extractTex(text: string): string {
  const blocks = [...text.matchAll(/```(?:latex|tex)?\s*([\s\S]*?)```/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean)
  if (blocks.length > 0) return blocks.sort((a, b) => b.length - a.length)[0]
  return text.trim()
}

function explainPrompt(lean: string, problem: string, latest: { tex: string; message: string } | null): string {
  const shared = `Write a complete LaTeX document of the human-readable proof.

Rules:
- Follow the Lean proof. Do not invent a different argument.
- Use the problem's wording and notation.
- Output a compilable document with \\documentclass{article} and \\usepackage{amsmath,amssymb,amsthm}.
- Use LaTeX math, not Markdown and not Lean syntax.
- Do not wrap the answer in a code fence.
- Put the statement and the proof in the document body.`
  const parts = [shared]
  if (problem.trim()) parts.push(`Problem:\n${cap(problem)}`)
  parts.push(`Lean proof:\n${cap(lean)}`)
  if (latest) {
    parts.push(
      `This attempt did not compile. Write the document again.\n\nLatest document:\n${cap(latest.tex) || '(empty)'}\n\npdflatex:\n${cap(latest.message)}`
    )
  }
  return parts.join('\n\n')
}

function cap(source: string): string {
  return source.length > 20_000 ? source.slice(0, 20_000) : source
}
