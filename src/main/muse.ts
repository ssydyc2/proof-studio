import path from 'node:path'
import OpenAI from 'openai'
import { formalizeSource } from './formalize'
import { compileLeanSource, installLeanProject, prepareLean, removeLeanProject } from './lean'
import { FORMALIZE_ATTEMPTS, type FormalizeProgress } from '../shared/formalize'
import { ensureLatexDocument, LEAN_DIR, type ProblemSummary } from '../shared/problem'
import { problemDirectory, readFile, readSource, recordProblemError, writeLeanStub, writeProblemText } from './workspace'

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
    return writeProblemText(id, tex)
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
    onProgress?.({ phase: 'setup', attempt: 0, total: FORMALIZE_ATTEMPTS })
    const project = await prepareLean()
    const source = await formalizeSource({
      tex: texFile.text,
      toolchain: project.toolchain,
      onAttempt: (attempt) => onProgress?.({ phase: 'attempt', attempt, total: FORMALIZE_ATTEMPTS }),
      ask: (prompt) => askMuse(key, prompt),
      compile: compileLeanSource
    })
    const summary = writeLeanStub(id, source)
    const dir = problemDirectory(id)
    await installLeanProject(path.join(dir, LEAN_DIR))
    removeLeanProject(dir)
    return summary
  } catch (error) {
    failStep(id, 'leanStub', explainMuseError(error, key))
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
    reasoning: { effort: 'high' },
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

function failStep(id: string, key: 'problemText' | 'leanStub', message: string): never {
  if (readFile(id, key).kind !== 'text') recordProblemError(id, key, message)
  throw new Error(message)
}

function isEmptyTranscription(error: unknown): boolean {
  return error instanceof Error && error.message === 'The transcription was empty.'
}
