import path from 'node:path'
import OpenAI from 'openai'
import { formalizeSource } from './formalize'
import { compileTex } from './latex'
import { compileLeanSource, installLeanProject, prepareLean, removeLeanProject } from './lean'
import { proveSource } from './prove'
import { FORMALIZE_ATTEMPTS, type FormalizeProgress } from '../shared/formalize'
import { proofAttemptCount, type ProveProgress } from '../shared/prove'
import { ensureLatexDocument, PROBLEM_ENV, SOLUTION_ENV, type ProblemSummary } from '../shared/problem'
import {
  problemDirectory,
  readFile,
  readSource,
  recordProblemError,
  writeLeanProof,
  writeLeanStub,
  writeProblemText
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
  try {
    const text = await transcribeImage(apiKey, source.bytes, source.mime)
    const tex = ensureLatexDocument(text)
    if (!tex) failTranscription(id, 'The transcription was empty.')
    const summary = writeProblemText(id, tex)
    await compileTex(id, 'problemText')
    return summary
  } catch (error) {
    if (isEmptyTranscription(error)) throw error
    failTranscription(id, explainMuseError(error, apiKey))
  }
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

export async function formalizeProblem(
  id: string,
  onProgress?: (progress: FormalizeProgress) => void
): Promise<ProblemSummary> {
  if (!hasApiKey() || !apiKey) throw new Error('Enter an API key first.')
  const texFile = readFile(id, 'problemText')
  if (texFile.kind !== 'text' || !texFile.text.trim()) throw new Error('No problem text yet.')
  const key = apiKey
  try {
    const rounds: FormalizeProgress['rounds'] = []
    const publish = (progress: FormalizeProgress) => onProgress?.(progress)
    publish({ phase: 'setup', attempt: 0, total: FORMALIZE_ATTEMPTS, statement: 1, rounds })
    const project = await prepareLean()
    const source = await formalizeSource({
      tex: texFile.text,
      toolchain: project.toolchain,
      onAttempt: (attempt, statement) =>
        publish({ phase: 'attempt', attempt, total: FORMALIZE_ATTEMPTS, statement, rounds: [...rounds] }),
      onRound: (round) => {
        rounds.push(round)
        publish({ phase: 'round', attempt: round.attempt, total: FORMALIZE_ATTEMPTS, statement: 1, rounds: [...rounds] })
      },
      ask: (prompt) => askMuse(key, prompt),
      compile: compileLeanSource
    })
    const summary = writeLeanStub(id, source)
    const dir = problemDirectory(id)
    await installLeanProject(path.join(dir, PROBLEM_ENV))
    removeLeanProject(dir)
    return summary
  } catch (error) {
    failStep(id, 'leanStub', explainMuseError(error, key))
  }
}

export async function proveProblem(
  id: string,
  attempts: number,
  onProgress?: (progress: ProveProgress) => void
): Promise<ProblemSummary> {
  if (!hasApiKey() || !apiKey) throw new Error('Enter an API key first.')
  const stub = readFile(id, 'leanStub')
  if (stub.kind !== 'text' || !stub.text.trim()) throw new Error('No Lean stub yet.')
  const count = proofAttemptCount(attempts)
  const key = apiKey
  try {
    const rounds: ProveProgress['rounds'] = []
    let running: ProveProgress['running'] = []
    const publish = (progress: ProveProgress) => onProgress?.(progress)
    publish({ phase: 'setup', statement: 1, attempt: 0, total: count, rounds, running })
    const project = await prepareLean()
    const source = await proveSource({
      stub: stub.text,
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
      ask: (prompt) => askMuse(key, prompt),
      compile: compileLeanSource
    })
    const summary = writeLeanProof(id, source)
    await installLeanProject(path.join(problemDirectory(id), SOLUTION_ENV))
    return summary
  } catch (error) {
    failStep(id, 'leanProof', explainMuseError(error, key))
  }
}

async function askMuse(key: string, prompt: string): Promise<string> {
  const client = new OpenAI({
    apiKey: key,
    baseURL: BASE_URL,
    timeout: 300_000
  })
  const response = await client.responses.create({
    model: MODEL,
    reasoning: { effort: 'xhigh' },
    input: [
      {
        role: 'user',
        content: [{ type: 'input_text', text: prompt }]
      }
    ]
  })
  return response.output_text ?? ''
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

function failStep(id: string, key: 'problemText' | 'leanStub' | 'leanProof', message: string): never {
  if (readFile(id, key).kind !== 'text') recordProblemError(id, key, message)
  throw new Error(message)
}

function isEmptyTranscription(error: unknown): boolean {
  return error instanceof Error && error.message === 'The transcription was empty.'
}
