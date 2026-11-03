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

export async function judgeProblemImages(
  key: string,
  screenshot: Buffer,
  pages: Buffer[]
): Promise<{ same: boolean; reason: string }> {
  const trimmed = key.trim()
  if (!trimmed) throw new Error('Enter an API key.')
  if (pages.length === 0) throw new Error('The PDF has no pages.')
  const images = [screenshot, ...pages].map((bytes) => ({
    type: 'image_url',
    image_url: { url: `data:image/png;base64,${bytes.toString('base64')}` }
  }))
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
      messages: [
        {
          role: 'user',
          content: [...images, { type: 'text', text: JUDGE_PROMPT }]
        }
      ]
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
