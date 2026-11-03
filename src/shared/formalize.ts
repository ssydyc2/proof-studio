export const FORMALIZE_ATTEMPTS = 3

export type FormalizeProgress = {
  phase: 'setup' | 'attempt'
  attempt: number
  total: number
}
