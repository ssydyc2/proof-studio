import OpenAI from 'openai'

const MODEL = 'muse-wonder-1.0'
const BASE_URL = 'https://api.meta.ai/v1'

const JUDGE_PROMPT = `You are checking a transcription of a mathematics problem.

The first image is the original problem. The later images are the pages of a PDF compiled from the transcription.

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
  const client = new OpenAI({
    apiKey: trimmed,
    baseURL: BASE_URL,
    timeout: 120_000
  })
  const response = await client.responses.create({
    model: MODEL,
    reasoning: { effort: 'medium' },
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: JUDGE_PROMPT },
          { type: 'input_image', image_url: `data:image/png;base64,${screenshot.toString('base64')}`, detail: 'high' },
          ...pages.map((page) => ({
            type: 'input_image' as const,
            image_url: `data:image/png;base64,${page.toString('base64')}`,
            detail: 'high' as const
          }))
        ]
      }
    ]
  })
  return parseJudge(stripFence(response.output_text ?? ''))
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
