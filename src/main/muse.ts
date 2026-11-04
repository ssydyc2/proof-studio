import path from 'node:path'
import OpenAI from 'openai'
import { Agent, fetch as undiciFetch } from 'undici'
import { explainSource } from './explain'
import { formalizeSource } from './formalize'
import { compileTex } from './latex'
import { compileLeanSource, installLeanProject, prepareLean, removeLeanProject } from './lean'
import { proveSource } from './prove'
import { EXPLAIN_ATTEMPTS, type ExplainProgress } from '../shared/explain'
import { leanLines, parseLeanRanges, type LeanRange } from '../shared/locate'
import { FORMALIZE_ATTEMPTS, type FormalizeProgress } from '../shared/formalize'
import { PROOF_REQUEST_MS, proofAttemptCount, type ProveProgress } from '../shared/prove'
import { ensureLatexDocument, PROBLEM_ENV, SOLUTION_ENV, type ProblemSummary } from '../shared/problem'
import {
  problemDirectory,
  readFile,
  readSource,
  recordProblemError,
  writeLeanProof,
  writeLeanStub,
  writeProblemText,
  writeSolutionText
} from './workspace'

const MODEL = 'muse-wonder-1.0'
const BASE_URL = 'https://api.meta.ai/v1'

const TRANSCRIBE_PROMPT = `Transcribe this image into a complete LaTeX document of the problem statement only.

Rules:
- Output a compilable LaTeX document with \\documentclass{article} and \\usepackage{amsmath,amssymb,amsthm}.
- Preserve the wording and notation. Do not solve the problem, do not add assumptions, and do not add a proof.
- Put only the problem in the document body. Use LaTeX math, not Markdown.
- If the image is only a short sentence, that sentence is the body.
- Do not wrap the answer in a code fence.`

let apiKey: string | null = null

export function hasApiKey(): boolean {
  return apiKey != null && apiKey.length > 0
}

export function setApiKey(key: string): void {
  const trimmed = key.trim()
  if (!trimmed) throw new Error('Enter an API key.')
  apiKey = trimmed
}

export async function transcribeProblem(id: string): Promise<ProblemSummary> {
  if (!hasApiKey() || !apiKey) throw new Error('Enter an API key first.')
  const source = readSource(id)
  const key = apiKey
  try {
    const tex = await transcribeScreenshot(key, source.bytes, source.mime)
    const summary = writeProblemText(id, tex)
    await compileTex(id, 'problemText')
    return summary
  } catch (error) {
    if (isEmptyTranscription(error)) throw error
    failTranscription(id, explainMuseError(error, key))
  }
}

export async function transcribeScreenshot(key: string, bytes: Buffer, mime: string): Promise<string> {
  const trimmed = key.trim()
  if (!trimmed) throw new Error('Enter an API key.')
  const text = await transcribeImage(trimmed, bytes, mime)
  const tex = ensureLatexDocument(text)
  if (!tex) throw new Error('The transcription was empty.')
  return tex
}

async function transcribeImage(key: string, bytes: Buffer, mime: string): Promise<string> {
  const client = new OpenAI({
    apiKey: key,
    baseURL: BASE_URL,
    timeout: 120_000
  })
  const response = await client.responses.create({
    model: MODEL,
    reasoning: { effort: 'low' },
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: TRANSCRIBE_PROMPT },
          {
            type: 'input_image',
            image_url: `data:${mime};base64,${bytes.toString('base64')}`,
            detail: 'high'
          }
        ]
      }
    ]
  })
  return stripFence(response.output_text ?? '')
}

export async function formalizeTex(
  key: string,
  tex: string,
  onProgress?: (progress: FormalizeProgress) => void
): Promise<string> {
  const trimmed = key.trim()
  if (!trimmed) throw new Error('Enter an API key.')
  if (!tex.trim()) throw new Error('No problem text yet.')
  const rounds: FormalizeProgress['rounds'] = []
  const publish = (progress: FormalizeProgress) => onProgress?.(progress)
  publish({ phase: 'setup', attempt: 0, total: FORMALIZE_ATTEMPTS, statement: 1, rounds })
  const project = await prepareLean()
  return formalizeSource({
    tex,
    toolchain: project.toolchain,
    onAttempt: (attempt, statement) =>
      publish({ phase: 'attempt', attempt, total: FORMALIZE_ATTEMPTS, statement, rounds: [...rounds] }),
    onRound: (round) => {
      rounds.push(round)
      publish({ phase: 'round', attempt: round.attempt, total: FORMALIZE_ATTEMPTS, statement: 1, rounds: [...rounds] })
    },
    ask: (prompt) => askMuse(trimmed, prompt),
    compile: compileLeanSource
  })
}

export async function formalizeProblem(
  id: string,
  onProgress?: (progress: FormalizeProgress) => void
): Promise<ProblemSummary> {
  if (!hasApiKey() || !apiKey) throw new Error('Enter an API key first.')
  const texFile = readFile(id, 'problemText')
  if (texFile.kind !== 'text' || !texFile.text.trim()) throw new Error('No problem text yet.')
  const key = apiKey
  try {
    const source = await formalizeTex(key, texFile.text, onProgress)
    const summary = writeLeanStub(id, source)
    const dir = problemDirectory(id)
    await installLeanProject(path.join(dir, PROBLEM_ENV))
    removeLeanProject(dir)
    return summary
  } catch (error) {
    failStep(id, 'leanStub', explainMuseError(error, key))
  }
}

export async function proveStub(
  key: string,
  stub: string,
  attempts: number,
  onProgress?: (progress: ProveProgress) => void
): Promise<string> {
  const trimmed = key.trim()
  if (!trimmed) throw new Error('Enter an API key.')
  if (!stub.trim()) throw new Error('No Lean stub yet.')
  const count = proofAttemptCount(attempts)
  const rounds: ProveProgress['rounds'] = []
  let running: ProveProgress['running'] = []
  const publish = (progress: ProveProgress) => onProgress?.(progress)
  publish({ phase: 'setup', statement: 1, attempt: 0, total: count, rounds, running })
  const project = await prepareLean()
  return proveSource({
    stub,
    toolchain: project.toolchain,
    attempts: count,
    onRunning: (next) => {
      running = next
    },
    onAttempt: (statement, attempt) =>
      publish({ phase: 'attempt', statement, attempt, total: count, rounds: [...rounds], running: [...(running ?? [])] }),
    onRound: (round) => {
      rounds.push(round)
      publish({
        phase: 'round',
        statement: round.statement,
        attempt: round.attempt,
        total: count,
        rounds: [...rounds],
        running: [...(running ?? [])]
      })
    },
    ask: (prompt) => askMuse(trimmed, prompt, 'xhigh', PROOF_REQUEST_MS, 0),
    compile: compileLeanSource
  })
}

export async function proveProblem(
  id: string,
  attempts: number,
  onProgress?: (progress: ProveProgress) => void
): Promise<ProblemSummary> {
  if (!hasApiKey() || !apiKey) throw new Error('Enter an API key first.')
  const stub = readFile(id, 'leanStub')
  if (stub.kind !== 'text' || !stub.text.trim()) throw new Error('No Lean stub yet.')
  const key = apiKey
  try {
    const source = await proveStub(key, stub.text, attempts, onProgress)
    const summary = writeLeanProof(id, source)
    await installLeanProject(path.join(problemDirectory(id), SOLUTION_ENV))
    return summary
  } catch (error) {
    failStep(id, 'leanProof', explainMuseError(error, key))
  }
}

export async function explainProblem(
  id: string,
  onProgress?: (progress: ExplainProgress) => void
): Promise<ProblemSummary> {
  if (!hasApiKey() || !apiKey) throw new Error('Enter an API key first.')
  const proof = readFile(id, 'leanProof')
  if (proof.kind !== 'text' || !proof.text.trim()) throw new Error('No Lean proof yet.')
  const problem = readFile(id, 'problemText')
  const key = apiKey
  try {
    const rounds: ExplainProgress['rounds'] = []
    const publish = (progress: ExplainProgress) => onProgress?.(progress)
    let summary: ProblemSummary | null = null
    await explainSource({
      lean: proof.text,
      problem: problem.kind === 'text' ? problem.text : '',
      onAttempt: (attempt) => publish({ phase: 'attempt', attempt, total: EXPLAIN_ATTEMPTS, rounds: [...rounds] }),
      onRound: (round) => {
        rounds.push(round)
        publish({ phase: 'round', attempt: round.attempt, total: EXPLAIN_ATTEMPTS, rounds: [...rounds] })
      },
      ask: (prompt) => askMuse(key, prompt),
      compile: async (tex) => {
        summary = writeSolutionText(id, tex)
        try {
          await compileTex(id, 'solutionTex')
          return { ok: true }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'pdflatex failed.'
          return { ok: false, message }
        }
      }
    })
    if (!summary) throw new Error('The solution TeX was empty.')
    return summary
  } catch (error) {
    failStep(id, 'solutionTex', explainMuseError(error, key))
  }
}

export async function locateLean(id: string, passage: string): Promise<LeanRange[]> {
  if (!hasApiKey() || !apiKey) throw new Error('Enter an API key first.')
  const proof = readFile(id, 'leanProof')
  if (proof.kind !== 'text' || !proof.text.trim()) throw new Error('No Lean proof yet.')
  const text = passage.replace(/\u00a0/g, ' ').trim()
  if (!text) throw new Error('Select some text in the PDF first.')
  if (text.length > 4000) throw new Error('Select a shorter passage.')
  const lines = leanLines(proof.text)
  const numbered = lines.map((line, index) => `${index + 1}|${line}`).join('\n')
  let reply: string
  try {
    reply = await askMuse(apiKey, locatePrompt(text, numbered), 'medium', 90_000)
  } catch (error) {
    throw new Error(explainMuseError(error, apiKey))
  }
  const ranges = parseLeanRanges(reply, lines.length)
  if (ranges.length === 0) throw new Error('No Lean lines matched that selection.')
  return ranges
}

function locatePrompt(passage: string, numbered: string): string {
  const lean = numbered.length > 20_000 ? `${numbered.slice(0, 20_000)}\n…` : numbered
  return `The user selected this passage from a typeset proof. It was copied from a PDF, so spacing and line breaks may be messy.

Passage:
"""
${passage}
"""

Lean proof. Each line starts with its line number and a bar.

${lean}

Which lines of this Lean proof does the passage come from?
Reply with JSON only, no markdown:
{"ranges":[{"start":12,"end":18}]}

Rules:
- Line numbers are 1-based and inclusive.
- Return every Lean line the passage comes from.
- Use separate ranges when the lines are not contiguous.
- If nothing matches, return {"ranges":[]}.`
}

async function askMuse(
  key: string,
  prompt: string,
  effort: 'low' | 'medium' | 'high' | 'xhigh' = 'xhigh',
  timeout = 300_000,
  maxRetries = 2
): Promise<string> {
  const dispatcher = new Agent({ headersTimeout: timeout, bodyTimeout: timeout })
  try {
    const client = new OpenAI({
      apiKey: key,
      baseURL: BASE_URL,
      timeout,
      maxRetries,
      fetch: undiciFetch as unknown as typeof fetch,
      fetchOptions: { dispatcher }
    })
    const stream = await client.responses.create({
      model: MODEL,
      reasoning: { effort },
      stream: true,
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }]
        }
      ]
    })
    const parts: string[] = []
    for await (const event of stream) {
      if (event.type === 'response.output_text.done') parts.push(event.text)
    }
    return parts.join('')
  } finally {
    await dispatcher.close()
  }
}

function stripFence(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^```(?:markdown|md|latex|tex)?\s*([\s\S]*?)\s*```$/i)
  return (match ? match[1] : trimmed).trim()
}

function explainMuseError(error: unknown, key: string): string {
  let message = 'The request failed.'
  if (error instanceof OpenAI.APIError) {
    message = error.status === 401 ? 'The API key was rejected.' : error.message || `The request failed (${error.status ?? 'unknown'}).`
  } else if (error instanceof Error && error.message) {
    message = error.message
  }
  return message.split(key).join('[key]')
}

function failTranscription(id: string, message: string): never {
  failStep(id, 'problemText', message)
}

function failStep(id: string, key: 'problemText' | 'leanStub' | 'leanProof' | 'solutionTex', message: string): never {
  if (readFile(id, key).kind !== 'text') recordProblemError(id, key, message)
  throw new Error(message)
}

function isEmptyTranscription(error: unknown): boolean {
  return error instanceof Error && error.message === 'The transcription was empty.'
}
