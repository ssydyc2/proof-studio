export const PROOF_ATTEMPTS = 3
export const PROOF_STATEMENTS = 2

export type ProveRound = {
  statement: number
  attempt: number
  ok: boolean
  returned: string
  detail: string
}

export type ProveProgress = {
  phase: 'setup' | 'attempt' | 'round'
  statement: number
  attempt: number
  total: number
  rounds: ProveRound[]
}
