export const FORMALIZE_ATTEMPTS = 2

export type FormalizeRound = {
  attempt: number
  ok: boolean
  returned: string
  detail: string
}

export type FormalizeProgress = {
  phase: 'setup' | 'attempt' | 'round'
  attempt: number
  total: number
  statement: number
  rounds: FormalizeRound[]
}
