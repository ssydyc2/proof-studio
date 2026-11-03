const MODEL = 'glm-5.3-flash'
const BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'

const JUDGE_PROMPT = `You are checking a transcription of a mathematics problem.

The images follow. The first image is the original problem. The later images are the pages of a PDF compiled from the transcription.

Decide whether they state the same problem. Compare the hypotheses, the notation, and what must be proved.

Treat these as the same problem:
- differences in line breaks, fonts, or a bold title
- equivalent notation, such as Z and \\mathbb{Z}
- a title or source line that only names the problem

Treat these as different:
- a changed, missing, or added condition
- a wrong index, exponent, quantifier, or constant
- a different claim
- a proof added where the original has only the problem

Reply with JSON only, no Markdown:
{"same":true,"reason":"one sentence"}`

const FORMALIZE_PROMPT = `The image is a mathematics problem. The Lean 4 text is an attempt to state that problem twice. The proofs are sorry and are not part of the check.

Decide whether both theorems are correct statements of this same problem. They may use different Lean encodings.

A statement is wrong when it drops or changes a hypothesis, changes a quantifier, index, exponent, or constant, or claims something other than the problem.

Reply with JSON only, no Markdown:
{"same":true,"reason":"one sentence"}`

type ContentPart = { type: string; text?: string; image_url?: { url: string } }

export async function judgeProblemImages(
  key: string,
  screenshot: Buffer,
  pages: Buffer[]
): Promise<{ same: boolean; reason: string }> {
  if (pages.length === 0) throw new Error('The PDF has no pages.')
  const images = [screenshot, ...pages].map(imagePart)
  return ask(key, [...images, { type: 'text', text: JUDGE_PROMPT }])
}

export async function judgeFormalization(
  key: string,
  screenshot: Buffer,
  lean: string
): Promise<{ same: boolean; reason: string }> {
  const source = lean.length > 20_000 ? `${lean.slice(0, 20_000)}\n…` : lean
  return ask(key, [
    imagePart(screenshot),
    { type: 'text', text: `${FORMALIZE_PROMPT}\n\nLean:\n${source}` }
  ])
}

function imagePart(bytes: Buffer): ContentPart {
  return { type: 'image_url', image_url: { url: `data:image/png;base64,${bytes.toString('base64')}` } }
}

async function ask(key: string, content: ContentPart[]): Promise<{ same: boolean; reason: string }> {
  const trimmed = key.trim()
  if (!trimmed) throw new Error('Enter an API key.')
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${trimmed}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 1,
      top_p: 0.95,
      max_tokens: 4096,
      reasoning_effort: 'high',
      thinking: { type: 'enabled', clear_thinking: false },
      messages: [{ role: 'user', content }]
    }),
    signal: AbortSignal.timeout(180_000)
  })
  const payload = (await response.json()) as {
    error?: { message?: string }
    choices?: { message?: { content?: unknown; reasoning_content?: unknown } }[]
  }
  if (!response.ok) {
    throw new Error(payload.error?.message || `GLM request failed (${response.status}).`)
  }
  const message = payload.choices?.[0]?.message
  const text = messageText(message?.content) || messageText(message?.reasoning_content)
  if (!text) throw new Error('GLM returned no comparison.')
  return parseJudge(stripFence(text))
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string' ? part.text : ''))
    .join('')
}

function parseJudge(text: string): { same: boolean; reason: string } {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('The comparison was not JSON.')
  let parsed: { same?: unknown; reason?: unknown }
  try {
    parsed = JSON.parse(match[0]) as { same?: unknown; reason?: unknown }
  } catch {
    throw new Error('The comparison was not JSON.')
  }
  if (typeof parsed.same !== 'boolean') throw new Error('The comparison did not say whether the problems match.')
  return { same: parsed.same, reason: typeof parsed.reason === 'string' ? parsed.reason.trim() : '' }
}

function stripFence(text: string): string {
  const trimmed = text.trim()
  const match = trimmed.match(/^```(?:markdown|md|json)?\s*([\s\S]*?)\s*```$/i)
  return (match ? match[1] : trimmed).trim()
}
