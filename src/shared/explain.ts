export const EXPLAIN_ATTEMPTS = 3

export type ExplainRound = {
  attempt: number
  ok: boolean
  detail: string
}

export type ExplainProgress = {
  phase: 'attempt' | 'round'
  attempt: number
  total: number
  rounds: ExplainRound[]
}
