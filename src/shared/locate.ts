export type LeanRange = { start: number; end: number }

export function leanLines(text: string): string[] {
  const lines = text.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

export function parseLeanRanges(reply: string, lineCount: number): LeanRange[] {
  const match = reply.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('The reply did not include line numbers.')
  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    throw new Error('The reply did not include line numbers.')
  }
  const clean: LeanRange[] = []
  for (const range of rangesOf(parsed)) {
    if (!Number.isInteger(range.start) || !Number.isInteger(range.end)) continue
    if (range.start < 1 || range.end > lineCount || range.start > range.end) continue
    clean.push(range)
  }
  return mergeRanges(clean)
}

function rangesOf(value: unknown): LeanRange[] {
  if (!value || typeof value !== 'object') return []
  const record = value as { ranges?: unknown; start?: unknown; end?: unknown }
  if (Array.isArray(record.ranges)) {
    return record.ranges.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const range = item as { start?: unknown; end?: unknown }
      return [{ start: Number(range.start), end: Number(range.end) }]
    })
  }
  if (record.start != null || record.end != null) return [{ start: Number(record.start), end: Number(record.end) }]
  return []
}

function mergeRanges(ranges: LeanRange[]): LeanRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: LeanRange[] = []
  for (const range of sorted) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end + 1) last.end = Math.max(last.end, range.end)
    else merged.push({ start: range.start, end: range.end })
  }
  return merged
}
