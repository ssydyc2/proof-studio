export const PROOF_ATTEMPTS = 3
export const PROOF_ATTEMPT_MAX = 10
export const PROOF_STATEMENTS = 2

export function proofAttemptCount(value: unknown): number {
  const count = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(count) || count < 1 || count > PROOF_ATTEMPT_MAX) {
    throw new Error(`Enter an attempt count from 1 to ${PROOF_ATTEMPT_MAX}.`)
  }
  return count
}

export type ProveRound = {
  statement: number
  attempt: number
  ok: boolean
  returned: string
  detail: string
}

export type ProveRun = {
  statement: number
  attempt: number
}

export type ProveProgress = {
  phase: 'setup' | 'attempt' | 'round'
  statement: number
  attempt: number
  total: number
  rounds: ProveRound[]
  running?: ProveRun[]
}
